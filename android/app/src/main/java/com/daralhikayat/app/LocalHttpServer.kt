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

                // Web App Manifest disabled (using native app instead)
                path == "/manifest.json" -> {
                    val responseJson = JSONObject().apply {
                        put("error", "Not Found")
                        put("message", "DarAlHikayat - API Server Only")
                    }
                    sendJsonResponse(writer, responseJson.toString())
                }

                // Serve simple API Server description instead of the HTML page
                (method == "GET" || method == "HEAD") && (path == "/" || path == "/index.html" || path == "/keyboard") -> {
                    val infoText = "دار الحكايات — خادم API فقط"
                    if (method == "HEAD") {
                        sendHeaderResponse(writer, "text/plain; charset=utf-8", infoText.toByteArray(Charsets.UTF_8).size)
                    } else {
                        sendHtmlResponse(writer, infoText)
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

                // Fallback - 404 Not Found (DarAlHikayat API Server)
                else -> {
                    val infoText = "404 Not Found - DarAlHikayat API Server"
                    sendHtmlResponse(writer, infoText)
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
        writer.print("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n")
        writer.print("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Tablet-PIN, pin\r\n")
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
    }
}
