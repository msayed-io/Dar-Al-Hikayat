package com.daralhikayat.app

import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.PrintWriter
import java.net.InetAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.util.Collections
import java.util.concurrent.Executors

/**
 * Native Kotlin LocalHttpServer for Dar Al-Hikayat Remote Literary Keyboard.
 * Runs on port 8080 with 0.0.0.0 binding using ServerSocket to ensure true Android network accessibility.
 */
class LocalHttpServer(private val port: Int = 8080) {

    private var serverSocket: ServerSocket? = null
    @Volatile private var isRunning: Boolean = false
    private val executor = Executors.newCachedThreadPool()
    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * Callback for receiving commands directly in tablet editor (< 2ms response time)
     */
    var onCommandReceivedListener: ((action: String, params: Map<String, String>) -> Unit)? = null

    /**
     * Start the native HTTP server in a dedicated background thread.
     */
    fun start() {
        if (isRunning) return
        isRunning = true

        executor.execute {
            try {
                // Explicit ServerSocket binding to 0.0.0.0 on port 8080
                serverSocket = ServerSocket(port, 50, InetAddress.getByName("0.0.0.0"))
                Log.i(TAG, "LocalHttpServer successfully listening on http://0.0.0.0:$port/")

                while (isRunning && serverSocket?.isClosed == false) {
                    try {
                        val clientSocket = serverSocket?.accept() ?: break
                        executor.execute { handleClient(clientSocket) }
                    } catch (e: Exception) {
                        if (isRunning) {
                            Log.e(TAG, "Error accepting client connection: ${e.message}")
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start LocalHttpServer on port $port: ${e.message}", e)
                isRunning = false
            }
        }
    }

    /**
     * Stop the native HTTP server.
     */
    fun stop() {
        isRunning = false
        try {
            serverSocket?.close()
            serverSocket = null
            executor.shutdownNow()
            Log.i(TAG, "LocalHttpServer stopped.")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping LocalHttpServer: ${e.message}")
        }
    }

    fun isServerRunning(): Boolean = isRunning

    /**
     * Get the real IPv4 address of Wi-Fi or Hotspot interface (non-loopback, non-link-local)
     */
    fun getLocalIpAddress(): String {
        try {
            val interfaces = Collections.list(NetworkInterface.getNetworkInterfaces())
            var candidateIp = ""

            for (networkInterface in interfaces) {
                if (!networkInterface.isUp || networkInterface.isLoopback) continue
                val name = networkInterface.name.lowercase()

                // Skip virtual / tunnel interfaces
                if (name.contains("tun") || name.contains("p2p") || name.contains("vnet") || name.contains("docker")) {
                    continue
                }

                val addresses = Collections.list(networkInterface.inetAddresses)
                for (inetAddress in addresses) {
                    if (!inetAddress.isLoopbackAddress) {
                        val hostAddress = inetAddress.hostAddress ?: continue
                        // Check if valid IPv4 address (not IPv6, not link-local 169.254)
                        if (!hostAddress.contains(":") && !hostAddress.startsWith("169.254")) {
                            if (name.contains("wlan") || name.contains("ap") || name.contains("softap") || name.contains("eth")) {
                                return hostAddress
                            }
                            if (candidateIp.isEmpty()) {
                                candidateIp = hostAddress
                            }
                        }
                    }
                }
            }
            if (candidateIp.isNotEmpty()) return candidateIp
        } catch (e: Exception) {
            Log.e(TAG, "Error getting local IP address: ${e.message}")
        }
        return "127.0.0.1"
    }

    private fun handleClient(socket: Socket) {
        val startTime = System.currentTimeMillis()
        try {
            socket.soTimeout = 5000
            val reader = BufferedReader(InputStreamReader(socket.inputStream, "UTF-8"))
            val writer = PrintWriter(socket.outputStream)

            val requestLine = reader.readLine() ?: return
            val parts = requestLine.split(" ")
            if (parts.size < 2) return

            val method = parts[0].uppercase()
            val fullUrl = parts[1]

            // Parse path and query params
            val urlParts = fullUrl.split("?", limit = 2)
            val path = urlParts[0]
            val queryString = if (urlParts.size > 1) urlParts[1] else ""
            val queryParams = parseQueryParams(queryString)

            // Read Headers
            var contentLength = 0
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                if (line.isNullOrEmpty()) break
                if (line!!.lowercase().startsWith("content-length:")) {
                    contentLength = line!!.substring(15).trim().toIntOrNull() ?: 0
                }
            }

            // Read Body for POST
            var bodyString = ""
            if (method == "POST" && contentLength > 0) {
                val charBuffer = CharArray(contentLength)
                var bytesRead = 0
                while (bytesRead < contentLength) {
                    val read = reader.read(charBuffer, bytesRead, contentLength - bytesRead)
                    if (read == -1) break
                    bytesRead += read
                }
                bodyString = String(charBuffer, 0, bytesRead)
            }

            // Route Requests
            when {
                // OPTIONS for CORS preflight
                method == "OPTIONS" -> {
                    sendCorsResponse(writer)
                }

                // Web App Manifest for PWA installation
                path == "/manifest.json" -> {
                    sendJsonResponse(writer, MANIFEST_JSON)
                }

                // Serve Embedded Pure Literary Keyboard HTML UI on Root GET /
                (method == "GET" || method == "HEAD") && (path == "/" || path == "/index.html" || path == "/keyboard") -> {
                    if (method == "HEAD") {
                        sendHeaderResponse(writer, "text/html; charset=utf-8", HTML_REMOTE_PAGE.toByteArray(Charsets.UTF_8).size)
                    } else {
                        sendHtmlResponse(writer, HTML_REMOTE_PAGE)
                    }
                }

                // Core API Command Endpoint (/api/command)
                path == "/api/command" -> {
                    val params = HashMap<String, String>()
                    params.putAll(queryParams)

                    // Parse JSON body if present
                    if (bodyString.isNotEmpty() && bodyString.trim().startsWith("{")) {
                        try {
                            val json = JSONObject(bodyString)
                            val keys = json.keys()
                            while (keys.hasNext()) {
                                val k = keys.next()
                                params[k] = json.optString(k, "")
                            }
                        } catch (e: Exception) {
                            Log.w(TAG, "Failed to parse body JSON: ${e.message}")
                        }
                    }

                    val action = params["action"] ?: params["type"] ?: "type"
                    
                    // Dispatch command instantly to Main Thread UI (< 2ms)
                    mainHandler.post {
                        onCommandReceivedListener?.invoke(action, params)
                    }

                    val elapsed = System.currentTimeMillis() - startTime
                    val responseJson = JSONObject().apply {
                        put("ok", true)
                        put("action", action)
                        put("latencyMs", elapsed)
                        put("timestamp", System.currentTimeMillis())
                    }
                    sendJsonResponse(writer, responseJson.toString())
                }

                // Get Real Wi-Fi / Hotspot IP Endpoint (/api/ip or /api/remote-keyboard/ip)
                path == "/api/ip" || path == "/api/remote-keyboard/ip" -> {
                    val ip = getLocalIpAddress()
                    val responseJson = JSONObject().apply {
                        put("primaryIp", ip)
                        put("port", port)
                        put("connectionUrl", "http://$ip:$port/")
                    }
                    sendJsonResponse(writer, responseJson.toString())
                }

                // Status Check Endpoint
                path == "/api/status" -> {
                    val responseJson = JSONObject().apply {
                        put("status", "active")
                        put("server", "DarAlHikayat Native Kotlin ServerSocket")
                        put("port", port)
                        put("ip", getLocalIpAddress())
                    }
                    sendJsonResponse(writer, responseJson.toString())
                }

                // Fallback - Serve Remote Keyboard HTML
                else -> {
                    sendHtmlResponse(writer, HTML_REMOTE_PAGE)
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error handling client socket: ${e.message}")
        } finally {
            try {
                socket.close()
            } catch (_: Exception) {}
        }
    }

    private fun parseQueryParams(query: String): Map<String, String> {
        val map = HashMap<String, String>()
        if (query.isEmpty()) return map
        val pairs = query.split("&")
        for (pair in pairs) {
            val idx = pair.indexOf("=")
            if (idx > 0) {
                val key = URLDecoder.decode(pair.substring(0, idx), "UTF-8")
                val value = URLDecoder.decode(pair.substring(idx + 1), "UTF-8")
                map[key] = value
            } else if (pair.isNotEmpty()) {
                val key = URLDecoder.decode(pair, "UTF-8")
                map[key] = ""
            }
        }
        return map
    }

    private fun sendCorsResponse(writer: PrintWriter) {
        writer.print("HTTP/1.1 204 No Content\r\n")
        writer.print("Access-Control-Allow-Origin: *\r\n")
        writer.print("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n")
        writer.print("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With\r\n")
        writer.print("Access-Control-Max-Age: 86400\r\n")
        writer.print("Connection: close\r\n\r\n")
        writer.flush()
    }

    private fun sendHeaderResponse(writer: PrintWriter, contentType: String, length: Int) {
        writer.print("HTTP/1.1 200 OK\r\n")
        writer.print("Content-Type: $contentType\r\n")
        writer.print("Content-Length: $length\r\n")
        writer.print("Access-Control-Allow-Origin: *\r\n")
        writer.print("Connection: close\r\n\r\n")
        writer.flush()
    }

    private fun sendHtmlResponse(writer: PrintWriter, html: String) {
        val bytes = html.toByteArray(Charsets.UTF_8)
        writer.print("HTTP/1.1 200 OK\r\n")
        writer.print("Content-Type: text/html; charset=utf-8\r\n")
        writer.print("Content-Length: ${bytes.size}\r\n")
        writer.print("Access-Control-Allow-Origin: *\r\n")
        writer.print("Cache-Control: no-cache, no-store, must-revalidate\r\n")
        writer.print("Connection: close\r\n\r\n")
        writer.print(html)
        writer.flush()
    }

    private fun sendJsonResponse(writer: PrintWriter, json: String) {
        val bytes = json.toByteArray(Charsets.UTF_8)
        writer.print("HTTP/1.1 200 OK\r\n")
        writer.print("Content-Type: application/json; charset=utf-8\r\n")
        writer.print("Content-Length: ${bytes.size}\r\n")
        writer.print("Access-Control-Allow-Origin: *\r\n")
        writer.print("Cache-Control: no-cache\r\n")
        writer.print("Connection: close\r\n\r\n")
        writer.print(json)
        writer.flush()
    }

    companion object {
        private const val TAG = "LocalHttpServer"

        val MANIFEST_JSON: String = """
            {
              "id": "/",
              "name": "لوحة الرواية — كيبورد الكاتبة اللاسلكي",
              "short_name": "لوحة الرواية",
              "description": "كيبورد لاسلكي مخصص للروايات والكاتبات موصول بالتابلت",
              "start_url": "/",
              "display": "standalone",
              "orientation": "landscape",
              "background_color": "#141210",
              "theme_color": "#1D1A16",
              "icons": [
                {
                  "src": "/pwa-192x192.png",
                  "sizes": "192x192",
                  "type": "image/png"
                }
              ]
            }
        """.trimIndent()

        val HTML_REMOTE_PAGE: String = """
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>لوحة الرواية — كيبورد الكاتبة اللاسلكي</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#1D1A16">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<style>
  :root{
    box-sizing:border-box;
    padding-top:env(safe-area-inset-top,0px);
    padding-bottom:env(safe-area-inset-bottom,0px);
    --font-serif:'Amiri','Traditional Arabic','Scheherazade New','Times New Roman',serif;
    --font-sans:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;
    --paper:#F1E7CE;
    --ink:#2E2013;
    --bg:#E4D9BE;
    --panel:#D8C9A3;
    --panel-key:#F3ECDA;
    --text:#2B2520;
    --accent:#A97A2C;
    --accent-2:#7C3232;
    --border:rgba(43,32,19,.18);
    --shadow:rgba(43,32,19,.28);
    --muted:rgba(43,32,19,.55);
    color-scheme:light;
  }
  @media (prefers-color-scheme:dark){
    :root:not([data-theme="light"]){
      --bg:#141210;
      --panel:#1D1A16;
      --panel-key:#29241D;
      --text:#EDE3CB;
      --accent:#D8AE58;
      --accent-2:#C06A63;
      --border:rgba(255,255,255,.08);
      --shadow:rgba(0,0,0,.55);
      --muted:rgba(237,227,203,.55);
      color-scheme:dark;
    }
  }
  :root[data-theme="dark"]{
    --bg:#141210; --panel:#1D1A16; --panel-key:#29241D; --text:#EDE3CB;
    --accent:#D8AE58; --accent-2:#C06A63; --border:rgba(255,255,255,.08);
    --shadow:rgba(0,0,0,.55); --muted:rgba(237,227,203,.55); color-scheme:dark;
  }
  :root[data-theme="light"]{
    --bg:#E4D9BE; --panel:#D8C9A3; --panel-key:#F3ECDA; --text:#2B2520;
    --accent:#A97A2C; --accent-2:#7C3232; --border:rgba(43,32,19,.18);
    --shadow:rgba(43,32,19,.28); --muted:rgba(43,32,19,.55); color-scheme:light;
  }
  *{box-sizing:border-box;}
  html,body{height:100%;margin:0;padding:0;overflow:hidden;}
  body{
    background:var(--bg); color:var(--text);
    font-family:var(--font-sans);
    -webkit-tap-highlight-color:transparent;
    display:flex; flex-direction:column; justify-content:space-between;
  }
  button{font-family:inherit; -webkit-user-select:none; user-select:none; cursor:pointer;}
  button:focus{outline:none;}

  .app{height:100%; display:flex; flex-direction:column; justify-content:space-between; animation:appear .25s ease both;}
  @keyframes appear{from{opacity:0; transform:translateY(4px);} to{opacity:1; transform:none;}}

  /* ---------- Header ---------- */
  .bar{
    flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:10px;
    padding:8px 14px; padding-top:calc(8px + env(safe-area-inset-top,0px));
    background:var(--panel); border-bottom:1px solid var(--border);
  }
  .brand{display:flex; align-items:center; gap:8px; min-width:0;}
  .brand .icon{font-size:1.3rem;}
  .brand .titles{display:flex; flex-direction:column; line-height:1.15; min-width:0;}
  .brand .titles strong{font-weight:700; font-size:1rem; color:var(--text); white-space:nowrap;}
  .brand .titles span{font-size:.68rem; color:var(--accent); white-space:nowrap; font-weight:600;}
  .header-controls{display:flex; align-items:center; gap:6px;}
  .status-badge{
    display:flex; align-items:center; gap:5px; font-size:.72rem; color:#34d399;
    background:rgba(16,185,129,.15); border:1px solid rgba(16,185,129,.3);
    padding:3px 10px; border-radius:9999px; font-weight:700;
  }
  .dot{width:7px; height:7px; border-radius:50%; background:#10b981; animation:pulse 1.5s infinite;}
  @keyframes pulse{0%,100%{opacity:1; transform:scale(1);} 50%{opacity:.5; transform:scale(1.2);}}

  .ctrl-btn{
    width:36px; height:36px; border-radius:9999px; background:var(--panel-key);
    border:1px solid var(--border); color:var(--text); display:flex; align-items:center;
    justify-content:center; font-size:1rem; touch-action:none; font-weight:bold;
  }
  .ctrl-btn.pressed{background:var(--accent); color:#fff;}

  /* ---------- Dedicated Keyboard Deck ---------- */
  .deck{
    flex:1 1 auto; min-height:0; display:flex; flex-direction:column; gap:6px;
    padding:8px 10px; padding-bottom:calc(8px + env(safe-area-inset-bottom,0px));
    background:var(--panel);
  }
  .tashkeel-row{flex:0 0 auto; display:flex; gap:6px; overflow-x:auto; padding-bottom:2px;}
  .tkey{
    flex:1 0 auto; min-width:44px; height:38px; display:flex; align-items:center;
    justify-content:center; background:var(--panel-key); border:1px solid var(--border);
    border-radius:8px; font-family:var(--font-serif); font-size:1.2rem; color:var(--text);
    touch-action:none; font-weight:bold;
  }
  .tkey.pressed{background:var(--accent); color:#fff;}

  .keys-wrap{flex:1 1 auto; display:flex; gap:8px; min-height:0;}
  .literary-col{flex:0 0 110px; display:flex; flex-direction:column; gap:6px;}
  .lkey-row{flex:1 1 0; display:flex; gap:6px; min-height:0;}
  .lkey{
    flex:1 1 0; display:flex; align-items:center; justify-content:center;
    background:var(--panel-key); border:1px solid var(--border); border-radius:9px;
    font-family:var(--font-serif); font-size:1.1rem; color:var(--text);
    box-shadow:0 2px 0 var(--shadow); touch-action:none; font-weight:bold;
  }
  .lkey.pressed{background:var(--accent-2); color:#fff; transform:translateY(2px); box-shadow:none;}

  .letters{flex:1 1 auto; display:flex; flex-direction:column; gap:6px; min-height:0;}
  .key-row{flex:1 1 0; display:flex; gap:6px; min-height:0;}
  .key{
    flex:1 1 0; min-width:0; display:flex; align-items:center; justify-content:center;
    background:var(--panel-key); border:1px solid var(--border); border-radius:10px;
    font-weight:700; font-size:clamp(1rem,2.8vw,1.3rem); color:var(--text);
    box-shadow:0 2px 0 var(--shadow); touch-action:none; position:relative;
  }
  .key.pressed{background:var(--accent); color:#fff; transform:translateY(2px); box-shadow:none;}
  .key.popup-active{box-shadow:0 0 0 2px var(--accent) inset;}
  .key .hint{position:absolute; top:2px; left:5px; font-size:.55rem; opacity:.5; font-weight:400;}

  .bottom-row{flex:0 0 54px; display:flex; gap:8px;}
  .spacebar{
    flex:1 1 auto; display:flex; align-items:center; justify-content:center;
    background:var(--panel-key); border:1px solid var(--border); border-radius:10px;
    font-size:.82rem; color:var(--muted); touch-action:none; text-align:center; padding:0 10px; font-weight:600;
  }
  .spacebar.pressed{background:var(--accent); color:#fff;}
  .side-btn{
    flex:0 0 58px; display:flex; align-items:center; justify-content:center;
    background:var(--panel-key); border:1px solid var(--border); border-radius:10px;
    font-size:1.25rem; color:var(--text); touch-action:none; font-weight:bold;
  }
  .side-btn.pressed, .side-btn.recording{background:var(--accent-2); color:#fff;}
  .side-btn.disabled{opacity:.35;}
  .side-btn.num-toggle{font-weight:700; font-size:.9rem;}
  .side-btn.recording{animation:pulse 1s ease-in-out infinite;}

  /* ---------- Variant popup (long-press) ---------- */
  .variant-popup{
    position:fixed; display:flex; gap:6px; padding:6px; background:var(--panel);
    border:1px solid var(--border); border-radius:12px; box-shadow:0 6px 18px var(--shadow); z-index:50;
  }
  .variant-popup.hidden{display:none;}
  .variant-btn{
    min-width:44px; height:44px; display:flex; align-items:center; justify-content:center;
    background:var(--panel-key); color:var(--text); border:1px solid var(--border);
    border-radius:8px; font-family:var(--font-serif); font-size:1.25rem; touch-action:none; font-weight:bold;
  }
  .variant-btn.pressed{background:var(--accent); color:#fff;}

  /* ---------- Rotate hint ---------- */
  .rotate-hint{
    position:fixed; inset:0; background:var(--bg); color:var(--text); display:none;
    flex-direction:column; align-items:center; justify-content:center; gap:10px; z-index:100;
    text-align:center; padding:24px;
  }
  .rotate-hint .glyph{font-size:2.4rem;}
  @media (orientation:portrait){ .rotate-hint{display:flex;} }
</style>
</head>
<body>

<div class="app">
  <header class="bar">
    <div class="brand">
      <span class="icon">✒️</span>
      <div class="titles">
        <strong>لوحة الرواية</strong>
        <span>موصول بالتابلت (<span id="lat">0.8ms</span>)</span>
      </div>
    </div>

    <div class="header-controls">
      <div class="status-badge">
        <span class="dot"></span>
        <span>متصل</span>
      </div>
      <!-- زر ملء الشاشة للتثبيت بدون شريط العنوان -->
      <button class="ctrl-btn" id="fullBtn" title="ملء الشاشة للتثبيت" type="button">⛶</button>
      <button class="ctrl-btn" id="paragraphBtn" title="فقرة جديدة" type="button">¶</button>
      <button class="ctrl-btn" id="undoBtn" title="تراجع" type="button">↺</button>
      <button class="ctrl-btn" id="redoBtn" title="إعادة" type="button">↻</button>
      <button class="ctrl-btn" id="themeBtn" title="تبديل الإضاءة" type="button">☾</button>
    </div>
  </header>

  <section class="deck" aria-label="لوحة المفاتيح اللاسلكية">
    <div class="tashkeel-row" id="tashkeelRow"></div>
    <div class="keys-wrap">
      <div class="literary-col" id="literaryCol"></div>
      <div class="letters" id="lettersArea"></div>
    </div>
    <div class="bottom-row">
      <button class="side-btn num-toggle" id="toggleNum" title="أرقام ورموز" type="button">١٢٣</button>
      <div class="spacebar" id="spacebar">اسحبي للتنقل بين الحروف · انقري لإدراج مسافة</div>
      <button class="side-btn" id="micBtn" title="إملاء صوتي" type="button">🎤</button>
      <button class="side-btn" id="backspaceBtn" title="حذف" type="button">⌫</button>
      <button class="side-btn" id="enterBtn" title="سطر جديد" type="button">↵</button>
    </div>
  </section>
</div>

<div class="variant-popup hidden" id="variantPopup"></div>

<div class="rotate-hint">
  <div class="glyph">📱↻</div>
  <div>أديري الهاتف إلى الوضع الأفقي لتجربة كتابة أفضل وأشمل</div>
</div>

<script>
(function(){
  "use strict";

  var tashkeelRow = document.getElementById('tashkeelRow');
  var literaryCol = document.getElementById('literaryCol');
  var lettersArea = document.getElementById('lettersArea');
  var popupEl = document.getElementById('variantPopup');
  var spacebar = document.getElementById('spacebar');
  var micBtn = document.getElementById('micBtn');
  var backspaceBtn = document.getElementById('backspaceBtn');
  var enterBtn = document.getElementById('enterBtn');
  var toggleNumBtn = document.getElementById('toggleNum');
  var undoBtn = document.getElementById('undoBtn');
  var redoBtn = document.getElementById('redoBtn');
  var paragraphBtn = document.getElementById('paragraphBtn');
  var themeBtn = document.getElementById('themeBtn');
  var fullBtn = document.getElementById('fullBtn');
  var latEl = document.getElementById('lat');

  /* ---------------- Haptics ---------------- */
  function buzz(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms||10); }catch(e){} }

  /* ---------------- Network dispatch to Native Server (/api/command) ---------------- */
  function sendCmd(action, extraParams){
    var start = performance.now();
    var url = '/api/command?action=' + encodeURIComponent(action);
    if(extraParams) url += '&' + extraParams;
    fetch(url).then(function(res){
      var elapsed = Math.round(performance.now() - start);
      if(latEl) latEl.textContent = elapsed + 'ms';
    }).catch(function(err){
      console.error('Command dispatch error:', err);
    });
  }

  /* ---------------- Generic pressable helper ---------------- */
  function pressable(el, onRelease){
    el.setAttribute('tabindex', el.getAttribute('tabindex') || '-1');
    el.addEventListener('pointerdown', function(e){ e.preventDefault(); el.classList.add('pressed'); });
    var clear = function(){ el.classList.remove('pressed'); };
    el.addEventListener('pointerup', function(e){ e.preventDefault(); clear(); if(onRelease) onRelease(e); });
    el.addEventListener('pointercancel', clear);
    el.addEventListener('pointerleave', clear);
  }

  /* ---------------- Fullscreen Toggle for PWA / Mobile ---------------- */
  pressable(fullBtn, function(){
    buzz(15);
    if(!document.fullscreenElement){
      if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function(){});
    } else {
      if(document.exitFullscreen) document.exitFullscreen().catch(function(){});
    }
  });

  /* ---------------- Header controls ---------------- */
  pressable(undoBtn, function(){ sendCmd('undo'); buzz(10); });
  pressable(redoBtn, function(){ sendCmd('redo'); buzz(10); });
  pressable(paragraphBtn, function(){ sendCmd('newline'); buzz(10); });

  function currentIsDark(){
    var dt = document.documentElement.getAttribute('data-theme');
    if(dt === 'dark') return true;
    if(dt === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function refreshThemeIcon(){ themeBtn.textContent = currentIsDark() ? '☼' : '☾'; }
  try{
    var savedTheme = localStorage.getItem('riwaya_theme');
    if(savedTheme){ document.documentElement.setAttribute('data-theme', savedTheme); }
  }catch(e){ /* ignore */ }
  refreshThemeIcon();
  pressable(themeBtn, function(){
    var next = currentIsDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try{ localStorage.setItem('riwaya_theme', next); }catch(e){ /* ignore */ }
    refreshThemeIcon();
    buzz(8);
  });

  /* ---------------- Tashkeel ribbon ---------------- */
  var TASHKEEL = [
    {mark:'\u064E', name:'فتحة'},
    {mark:'\u064F', name:'ضمة'},
    {mark:'\u0650', name:'كسرة'},
    {mark:'\u0651', name:'شدة'},
    {mark:'\u0652', name:'سكون'},
    {mark:'\u064B', name:'تنوين فتح'},
    {mark:'\u064C', name:'تنوين ضم'},
    {mark:'\u064D', name:'تنوين كسر'},
    {mark:'\u0651\u064E', name:'شدة مع فتحة'}
  ];
  function renderTashkeel(){
    tashkeelRow.innerHTML = '';
    TASHKEEL.forEach(function(t){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'tkey';
      b.textContent = '\u0640' + t.mark;
      b.title = t.name;
      b.setAttribute('aria-label', t.name);
      pressable(b, function(){ sendCmd('tashkeel', 'char=' + encodeURIComponent(t.mark)); buzz(7); });
      tashkeelRow.appendChild(b);
    });
  }

  /* ---------------- Literary / dialogue tools ---------------- */
  var LITERARY = [
    {label:'« »', title:'علامتا تنصيص', quotes:true},
    {label:'—', title:'شرطة حوار', ch:'\u2014'},
    {label:'…', title:'نقاط استرسال', ch:'\u2026'},
    {label:'،', title:'فاصلة', ch:'\u060C'},
    {label:'؛', title:'فاصلة منقوطة', ch:'\u061B'},
    {label:'؟', title:'علامة استفهام', ch:'\u061F'}
  ];
  function renderLiterary(){
    literaryCol.innerHTML = '';
    var pairs = [[0,1],[2,3],[4,5]];
    pairs.forEach(function(pair){
      var row = document.createElement('div');
      row.className = 'lkey-row';
      pair.forEach(function(idx){
        var item = LITERARY[idx];
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'lkey';
        b.textContent = item.label;
        b.title = item.title;
        b.setAttribute('aria-label', item.title);
        pressable(b, function(){
          if(item.quotes){ sendCmd('type', 'char=' + encodeURIComponent('«»')); }
          else { sendCmd('type', 'char=' + encodeURIComponent(item.ch)); }
          buzz(9);
        });
        row.appendChild(b);
      });
      literaryCol.appendChild(row);
    });
  }

  /* ---------------- Letter keys (with long-press variants) ---------------- */
  var LETTER_ROWS = [
    [{c:'ض'},{c:'ص'},{c:'ث'},{c:'ق'},{c:'ف'},{c:'غ'},{c:'ع'},{c:'ه',v:['ه','ة']},{c:'خ'},{c:'ح'},{c:'ج'},{c:'د'},{c:'ذ'}],
    [{c:'ش'},{c:'س'},{c:'ي',v:['ي','ى','ئ']},{c:'ب'},{c:'ل',v:['ل','لا']},{c:'ا',v:['ا','أ','إ','آ','ء']},{c:'ت'},{c:'ن'},{c:'م'},{c:'ك'},{c:'ط'}],
    [{c:'ئ'},{c:'ء'},{c:'ؤ',v:['ؤ','و']},{c:'ر'},{c:'لا'},{c:'ى'},{c:'ة'},{c:'و',v:['و','ؤ']},{c:'ز'},{c:'ظ'}]
  ];
  var NUM_ROWS = [
    [{c:'١'},{c:'٢'},{c:'٣'},{c:'٤'},{c:'٥'},{c:'٦'},{c:'٧'},{c:'٨'},{c:'٩'},{c:'٠'}],
    [{c:'('},{c:')'},{c:'-'},{c:'/'},{c:':'},{c:'؛'},{c:'"'},{c:'!'},{c:'؟'},{c:'.'}]
  ];
  var numMode = false;

  function hideVariantPopup(){
    popupEl.classList.add('hidden');
    var anchor = popupEl._anchor;
    if(anchor) anchor.classList.remove('popup-active');
    popupEl._anchor = null;
  }
  function showVariantPopup(anchorBtn, variants){
    buzz(14);
    popupEl.innerHTML = '';
    popupEl._anchor = anchorBtn;
    anchorBtn.classList.add('popup-active');
    variants.forEach(function(v){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'variant-btn';
      b.textContent = v;
      pressable(b, function(e){
        e.stopPropagation();
        sendCmd('type', 'char=' + encodeURIComponent(v));
        buzz(10);
        hideVariantPopup();
      });
      popupEl.appendChild(b);
    });
    popupEl.classList.remove('hidden');
    var rect = anchorBtn.getBoundingClientRect();
    popupEl.style.left = '0px'; popupEl.style.top = '0px';
    requestAnimationFrame(function(){
      var pw = popupEl.offsetWidth, ph = popupEl.offsetHeight;
      var left = rect.left + rect.width/2 - pw/2;
      left = Math.max(6, Math.min(window.innerWidth - 6 - pw, left));
      var top = rect.top - ph - 8;
      if(top < 6) top = rect.bottom + 8;
      popupEl.style.left = left + 'px';
      popupEl.style.top = top + 'px';
    });
  }
  document.addEventListener('pointerdown', function(e){
    if(!popupEl.classList.contains('hidden') && !popupEl.contains(e.target)){
      hideVariantPopup();
    }
  });

  function createKeyButton(item){
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'key'; btn.setAttribute('tabindex','-1');
    btn.textContent = item.c;
    btn.setAttribute('aria-label', item.c);
    if(item.v && item.v.length > 1){
      var hint = document.createElement('span');
      hint.className = 'hint'; hint.textContent = '…';
      btn.appendChild(hint);
    }
    var timer = null, longFired = false, startX = 0, startY = 0;
    btn.addEventListener('pointerdown', function(e){
      e.preventDefault();
      btn.classList.add('pressed');
      startX = e.clientX; startY = e.clientY; longFired = false;
      if(item.v && item.v.length > 1){
        timer = setTimeout(function(){
          longFired = true;
          showVariantPopup(btn, item.v);
        }, 420);
      }
    });
    btn.addEventListener('pointermove', function(e){
      if(timer && (Math.abs(e.clientX-startX) > 10 || Math.abs(e.clientY-startY) > 10)){
        clearTimeout(timer); timer = null;
      }
    });
    btn.addEventListener('pointerup', function(e){
      e.preventDefault();
      btn.classList.remove('pressed');
      if(timer){ clearTimeout(timer); timer = null; }
      if(!longFired){ sendCmd('type', 'char=' + encodeURIComponent(item.c)); buzz(9); }
    });
    btn.addEventListener('pointercancel', function(){
      btn.classList.remove('pressed');
      if(timer){ clearTimeout(timer); timer = null; }
    });
    return btn;
  }
  function renderLetters(){
    lettersArea.innerHTML = '';
    var rows = numMode ? NUM_ROWS : LETTER_ROWS;
    rows.forEach(function(rowArr){
      var rowEl = document.createElement('div');
      rowEl.className = 'key-row';
      rowArr.forEach(function(item){ rowEl.appendChild(createKeyButton(item)); });
      lettersArea.appendChild(rowEl);
    });
  }
  pressable(toggleNumBtn, function(){
    numMode = !numMode;
    toggleNumBtn.textContent = numMode ? 'أبجد' : '١٢٣';
    renderLetters();
    buzz(8);
  });

  /* ---------------- Spacebar trackpad ---------------- */
  var STEP = 16;
  var spX = 0, spDragging = false, spPointerId = null;
  spacebar.addEventListener('pointerdown', function(e){
    e.preventDefault();
    spX = e.clientX; spDragging = false; spPointerId = e.pointerId;
    spacebar.classList.add('pressed');
    try{ spacebar.setPointerCapture(e.pointerId); }catch(err){}
  });
  spacebar.addEventListener('pointermove', function(e){
    if(e.pointerId !== spPointerId) return;
    var dx = e.clientX - spX;
    var steps = Math.trunc(Math.abs(dx) / STEP);
    if(steps >= 1){
      var dir = dx < 0 ? 1 : -1;
      sendCmd('cursor_move', 'delta=' + dir * steps);
      spX += (dx < 0 ? -1 : 1) * steps * STEP;
      spDragging = true;
      buzz(5);
    }
  });
  spacebar.addEventListener('pointerup', function(e){
    e.preventDefault();
    spacebar.classList.remove('pressed');
    try{ spacebar.releasePointerCapture(e.pointerId); }catch(err){}
    if(!spDragging){ sendCmd('type', 'char=' + encodeURIComponent(' ')); buzz(9); }
    spPointerId = null;
  });
  spacebar.addEventListener('pointercancel', function(){ spacebar.classList.remove('pressed'); spPointerId = null; });

  /* ---------------- Backspace (tap + hold-to-repeat) ---------------- */
  var bsTimer, bsInterval;
  backspaceBtn.addEventListener('pointerdown', function(e){
    e.preventDefault();
    backspaceBtn.classList.add('pressed');
    sendCmd('backspace'); buzz(14);
    bsTimer = setTimeout(function(){
      bsInterval = setInterval(function(){ sendCmd('backspace'); buzz(8); }, 75);
    }, 400);
  });
  ['pointerup','pointercancel','pointerleave'].forEach(function(evt){
    backspaceBtn.addEventListener(evt, function(e){
      e.preventDefault();
      backspaceBtn.classList.remove('pressed');
      clearTimeout(bsTimer); clearInterval(bsInterval);
    });
  });

  /* ---------------- Enter ---------------- */
  pressable(enterBtn, function(){ sendCmd('newline'); buzz(9); });

  /* ---------------- Voice dictation ---------------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognition = null, listening = false;
  function setListening(v){
    listening = v;
    micBtn.classList.toggle('recording', v);
    micBtn.setAttribute('aria-pressed', v ? 'true' : 'false');
    micBtn.title = v ? 'إيقاف الإملاء' : 'إملاء صوتي';
  }
  if(SR){
    recognition = new SR();
    recognition.lang = 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = function(e){
      var text = '';
      for(var i = e.resultIndex; i < e.results.length; i++){
        if(e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      text = text.trim();
      if(text){
        sendCmd('paste', 'text=' + encodeURIComponent(text + ' '));
      }
    };
    recognition.onerror = function(){ setListening(false); };
    recognition.onend = function(){ setListening(false); };
    micBtn.addEventListener('pointerdown', function(e){ e.preventDefault(); micBtn.classList.add('pressed'); });
    ['pointerup','pointercancel','pointerleave'].forEach(function(evt){
      micBtn.addEventListener(evt, function(e){ e.preventDefault(); micBtn.classList.remove('pressed'); });
    });
    micBtn.addEventListener('pointerup', function(){
      if(listening){ recognition.stop(); setListening(false); }
      else {
        try{ recognition.start(); setListening(true); buzz(12); }
        catch(err){ /* ignore */ }
      }
    });
  } else {
    micBtn.disabled = true;
    micBtn.classList.add('disabled');
    micBtn.title = 'الإملاء الصوتي غير مدعوم في هذا المتصفح';
  }

  /* ---------------- Service Worker Registration for PWA ---------------- */
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/sw.js').catch(function(){});
  }

  /* ---------------- Init & Keep-Alive Ping ---------------- */
  renderTashkeel();
  renderLiterary();
  renderLetters();

  // Send periodic keep-alive ping every 5 seconds
  setInterval(function(){
    sendCmd('ping');
  }, 5000);
  sendCmd('ping');
})();
</script>
</body>
</html>
        """.trimIndent()
    }
}
