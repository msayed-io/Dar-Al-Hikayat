package com.daralhikayat.app

import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.OutputStreamWriter
import java.io.PrintWriter
import java.net.InetAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.util.Collections
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Native HTTP server used by the remote keyboard and wireless story transfer.
 * A successful start() means the socket is already bound and listening.
 */
class LocalHttpServer(private val port: Int = 8080) {

    companion object {
        private const val TAG = "LocalHttpServer"
        private const val MAX_REQUEST_BODY_BYTES = 12 * 1024 * 1024
        private const val TRANSFER_SESSION_TTL_MS = 10 * 60 * 1000L

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
              "icons": [{"src": "/pwa-192x192.png", "sizes": "192x192", "type": "image/png"}]
            }
        """.trimIndent()
    }

    private val stateLock = Any()
    private var serverSocket: ServerSocket? = null
    private var executor: ExecutorService = Executors.newCachedThreadPool()
    @Volatile private var isRunning = false
    @Volatile private var isReady = false

    @Volatile var activeSessionPin: String = ""
    @Volatile var isSessionConnected: Boolean = false
    @Volatile var activeTransferPin: String = ""
    @Volatile var activeTransferPayload: String = ""
    @Volatile var activeTransferStatus: String = "idle"
    @Volatile private var activeTransferCreatedAt: Long = 0L

    private val mainHandler = Handler(Looper.getMainLooper())
    var onCommandReceivedListener: ((action: String, params: Map<String, String>) -> Unit)? = null

    /** Bind synchronously so callers never use an unready server. */
    fun start() {
        synchronized(stateLock) {
            if (isServerRunning()) return
            if (executor.isShutdown || executor.isTerminated) {
                executor = Executors.newCachedThreadPool()
            }

            val socket = try {
                ServerSocket(port, 50, InetAddress.getByName("0.0.0.0"))
            } catch (e: Exception) {
                isRunning = false
                isReady = false
                Log.e(TAG, "Failed to bind LocalHttpServer on port $port: ${e.message}", e)
                throw e
            }

            serverSocket = socket
            isRunning = true
            isReady = true
            Log.i(TAG, "LocalHttpServer successfully listening on http://0.0.0.0:$port/")

            executor.execute {
                while (isRunning && socket.isBound && !socket.isClosed) {
                    try {
                        val clientSocket = socket.accept()
                        executor.execute { handleClient(clientSocket) }
                    } catch (e: Exception) {
                        if (isRunning) Log.e(TAG, "Error accepting client connection: ${e.message}", e)
                        break
                    }
                }
            }
        }
    }

    /** Stop the server and make the same instance safely restartable. */
    fun stop() {
        synchronized(stateLock) {
            isRunning = false
            isReady = false
            try { serverSocket?.close() } catch (e: Exception) {
                Log.w(TAG, "Error closing LocalHttpServer socket: ${e.message}")
            }
            serverSocket = null
            executor.shutdownNow()
            clearTransferSession()
            Log.i(TAG, "LocalHttpServer stopped.")
        }
    }

    fun isServerRunning(): Boolean =
        isRunning && isReady && serverSocket?.isBound == true && serverSocket?.isClosed == false

    /**
     * Prepare transfer data directly from the Capacitor bridge. The Android
     * sender must not POST its full library back to its own HTTP socket.
     */
    fun prepareTransferSession(pin: String, storiesJson: String): Int {
        if (!pin.matches(Regex("\\d{4}"))) {
            throw IllegalArgumentException("Transfer PIN must contain four digits")
        }
        val stories = JSONArray(storiesJson)
        if (stories.length() == 0) {
            throw IllegalArgumentException("Transfer stories array is empty")
        }
        synchronized(stateLock) {
            activeTransferPin = pin
            activeTransferPayload = stories.toString()
            activeTransferCreatedAt = System.currentTimeMillis()
            activeTransferStatus = "ready"
        }
        Log.i(TAG, "Transfer session prepared locally: ${stories.length()} stories")
        return stories.length()
    }

    /** Get the real IPv4 address of a Wi-Fi or hotspot interface. */
    fun getLocalIpAddress(): String {
        try {
            val interfaces = Collections.list(NetworkInterface.getNetworkInterfaces())
            var candidateIp = ""
            for (networkInterface in interfaces) {
                if (!networkInterface.isUp || networkInterface.isLoopback) continue
                val name = networkInterface.name.lowercase()
                if (name.contains("tun") || name.contains("p2p") || name.contains("vnet") || name.contains("docker")) continue
                for (inetAddress in Collections.list(networkInterface.inetAddresses)) {
                    if (inetAddress.isLoopbackAddress) continue
                    val hostAddress = inetAddress.hostAddress ?: continue
                    if (hostAddress.contains(":") || hostAddress.startsWith("169.254")) continue
                    if (name.contains("wlan") || name.contains("ap") || name.contains("softap") || name.contains("eth")) return hostAddress
                    if (candidateIp.isEmpty()) candidateIp = hostAddress
                }
            }
            if (candidateIp.isNotEmpty()) return candidateIp
        } catch (e: Exception) {
            Log.e(TAG, "Error getting local IP address: ${e.message}", e)
        }
        return "127.0.0.1"
    }

    private fun handleClient(socket: Socket) {
        val startTime = System.currentTimeMillis()
        try {
            socket.soTimeout = 15000
            val input = socket.getInputStream()
            val writer = PrintWriter(OutputStreamWriter(socket.outputStream, Charsets.UTF_8))

            val headBuffer = ByteArrayOutputStream()
            var tail = 0
            var headComplete = false
            while (headBuffer.size() <= 128 * 1024) {
                val b = input.read()
                if (b == -1) break
                headBuffer.write(b)
                tail = when {
                    tail == 0 && b == 13 -> 1
                    tail == 1 && b == 10 -> 2
                    tail == 2 && b == 13 -> 3
                    tail == 3 && b == 10 -> 4
                    b == 13 -> 1
                    else -> 0
                }
                if (tail == 4) { headComplete = true; break }
            }
            if (!headComplete) {
                sendErrorResponse(writer, 400, "BAD_REQUEST", "Incomplete HTTP request headers")
                return
            }

            val headerLines = String(headBuffer.toByteArray(), Charsets.UTF_8).split("\r\n")
            val requestParts = headerLines.firstOrNull()?.trim()?.split(Regex("\\s+")) ?: emptyList()
            if (requestParts.size < 2) {
                sendErrorResponse(writer, 400, "BAD_REQUEST", "Malformed HTTP request line")
                return
            }

            val method = requestParts[0].uppercase()
            val urlParts = requestParts[1].split("?", limit = 2)
            val path = urlParts[0]
            val queryParams = parseQueryParams(if (urlParts.size > 1) urlParts[1] else "")

            var contentLength = 0
            var isChunked = false
            for (line in headerLines.drop(1)) {
                val normalized = line.lowercase()
                if (normalized.startsWith("content-length:")) contentLength = line.substringAfter(":").trim().toIntOrNull() ?: -1
                if (normalized.startsWith("transfer-encoding:") && normalized.contains("chunked")) isChunked = true
            }
            if (isChunked) {
                sendErrorResponse(writer, 501, "CHUNKED_NOT_SUPPORTED", "Chunked request bodies are not supported")
                return
            }
            if (contentLength < 0 || contentLength > MAX_REQUEST_BODY_BYTES) {
                sendErrorResponse(writer, 413, "PAYLOAD_TOO_LARGE", "Request body is too large")
                return
            }

            val bodyString = if (method == "POST" && contentLength > 0) {
                val bytes = ByteArray(contentLength)
                var readTotal = 0
                while (readTotal < contentLength) {
                    val read = input.read(bytes, readTotal, contentLength - readTotal)
                    if (read == -1) break
                    readTotal += read
                }
                if (readTotal != contentLength) {
                    sendErrorResponse(writer, 400, "INCOMPLETE_BODY", "Incomplete request body")
                    return
                }
                String(bytes, Charsets.UTF_8)
            } else ""

            cleanupExpiredTransferSession()
            when {
                method == "OPTIONS" -> sendCorsResponse(writer)
                path == "/manifest.json" && (method == "GET" || method == "HEAD") -> sendJsonResponse(writer, MANIFEST_JSON)
                (method == "GET" || method == "HEAD") && (path == "/" || path == "/index.html" || path == "/keyboard") -> {
                    val infoText = "دار الحكايات — خادم API فقط"
                    if (method == "HEAD") sendHeaderResponse(writer, "text/plain; charset=utf-8", infoText.toByteArray(Charsets.UTF_8).size) else sendHtmlResponse(writer, infoText)
                }
                path == "/api/command" && (method == "GET" || method == "POST") -> handleCommand(writer, queryParams, bodyString, startTime)
                (path == "/api/ip" || path == "/api/remote-keyboard/ip") && method == "GET" -> {
                    val ip = getLocalIpAddress()
                    sendJsonResponse(writer, JSONObject().apply {
                        put("primaryIp", ip); put("port", port); put("connectionUrl", "http://$ip:$port/"); put("isNativeServerRunning", isServerRunning())
                    }.toString())
                }
                path == "/api/status" && method == "GET" -> {
                    sendJsonResponse(writer, JSONObject().apply {
                        put("status", if (isServerRunning()) "active" else "stopped"); put("server", "DarAlHikayat Native Kotlin ServerSocket"); put("port", port); put("ip", getLocalIpAddress()); put("ready", isServerRunning())
                    }.toString())
                }
                path == "/api/transfer/prepare" && method == "POST" -> prepareTransfer(writer, bodyString)
                path == "/api/transfer/stories" && method == "GET" -> serveTransferStories(writer, queryParams["pin"] ?: "")
                path == "/api/transfer/complete" && method == "POST" -> completeTransfer(writer, bodyString)
                path == "/api/transfer/status" && method == "GET" -> transferStatus(writer, queryParams["pin"] ?: "")
                else -> sendErrorResponse(writer, 404, "NOT_FOUND", "Endpoint not found")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling client socket: ${e.message}", e)
        } finally {
            try { socket.close() } catch (_: Exception) { }
        }
    }

    private fun handleCommand(writer: PrintWriter, queryParams: Map<String, String>, bodyString: String, startTime: Long) {
        val params = HashMap<String, String>()
        params.putAll(queryParams)
        if (bodyString.isNotBlank() && bodyString.trim().startsWith("{")) {
            try {
                val json = JSONObject(bodyString)
                val keys = json.keys()
                while (keys.hasNext()) { val key = keys.next(); params[key] = json.optString(key, "") }
            } catch (_: Exception) {
                sendErrorResponse(writer, 400, "INVALID_JSON", "Invalid command JSON")
                return
            }
        }
        val action = params["action"] ?: params["type"] ?: "type"
        val incomingPin = params["pin"] ?: params["sessionPin"] ?: ""
        if (activeSessionPin.isNotEmpty() && incomingPin != activeSessionPin) {
            sendErrorResponse(writer, 401, "PIN_MISMATCH", "Session PIN is invalid")
            return
        }
        mainHandler.post { onCommandReceivedListener?.invoke(action, params) }
        sendJsonResponse(writer, JSONObject().apply {
            put("ok", true); put("action", action); put("latencyMs", System.currentTimeMillis() - startTime); put("timestamp", System.currentTimeMillis())
        }.toString())
    }

    private fun prepareTransfer(writer: PrintWriter, bodyString: String) {
        if (bodyString.isBlank()) { sendErrorResponse(writer, 400, "EMPTY_BODY", "Transfer payload is required"); return }
        try {
            val json = JSONObject(bodyString)
            val pin = json.optString("pin", "")
            val stories = json.optJSONArray("stories")
            if (!pin.matches(Regex("\\d{4}")) || stories == null || stories.length() == 0) {
                sendErrorResponse(writer, 400, "INVALID_TRANSFER", "A four-digit PIN and non-empty stories array are required")
                return
            }
            val count = prepareTransferSession(pin, stories.toString())
            sendJsonResponse(writer, JSONObject().apply { put("ok", true); put("pin", pin); put("count", count) }.toString())
        } catch (e: Exception) {
            Log.w(TAG, "Invalid transfer preparation payload: ${e.message}")
            sendErrorResponse(writer, 400, "INVALID_JSON", "Invalid transfer JSON")
        }
    }

    private fun serveTransferStories(writer: PrintWriter, incomingPin: String) {
        if (activeTransferPin.isEmpty() || activeTransferPayload.isEmpty()) { sendErrorResponse(writer, 404, "NO_TRANSFER", "No active transfer session"); return }
        if (incomingPin != activeTransferPin) { sendErrorResponse(writer, 401, "PIN_MISMATCH", "Transfer PIN is invalid"); return }
        activeTransferStatus = "transferring"
        sendJsonResponse(writer, activeTransferPayload)
    }

    private fun completeTransfer(writer: PrintWriter, bodyString: String) {
        val incomingPin = try { if (bodyString.isBlank()) "" else JSONObject(bodyString).optString("pin", "") } catch (_: Exception) {
            sendErrorResponse(writer, 400, "INVALID_JSON", "Invalid completion JSON"); return
        }
        if (activeTransferPin.isEmpty() || incomingPin != activeTransferPin) { sendErrorResponse(writer, 401, "PIN_MISMATCH", "Transfer PIN is invalid"); return }
        activeTransferStatus = "completed"
        sendJsonResponse(writer, """{"ok":true}""")
    }

    private fun transferStatus(writer: PrintWriter, incomingPin: String) {
        if (activeTransferPin.isEmpty()) { sendJsonResponse(writer, """{"status":"idle"}"""); return }
        if (incomingPin != activeTransferPin) { sendErrorResponse(writer, 401, "PIN_MISMATCH", "Transfer PIN is invalid"); return }
        sendJsonResponse(writer, JSONObject().apply {
            put("status", activeTransferStatus); put("count", JSONArray(activeTransferPayload).length()); put("createdAt", activeTransferCreatedAt)
        }.toString())
    }

    private fun cleanupExpiredTransferSession() {
        if (activeTransferPin.isNotEmpty() && System.currentTimeMillis() - activeTransferCreatedAt > TRANSFER_SESSION_TTL_MS) clearTransferSession()
    }

    private fun clearTransferSession() {
        activeTransferPin = ""; activeTransferPayload = ""; activeTransferStatus = "idle"; activeTransferCreatedAt = 0L
    }

    private fun parseQueryParams(query: String): Map<String, String> {
        val map = HashMap<String, String>()
        if (query.isEmpty()) return map
        for (pair in query.split("&")) {
            if (pair.isEmpty()) continue
            val idx = pair.indexOf("=")
            try {
                if (idx > 0) map[URLDecoder.decode(pair.substring(0, idx), "UTF-8")] = URLDecoder.decode(pair.substring(idx + 1), "UTF-8")
                else map[URLDecoder.decode(pair, "UTF-8")] = ""
            } catch (_: IllegalArgumentException) { Log.w(TAG, "Invalid URL query encoding") }
        }
        return map
    }

    private fun sendCorsResponse(writer: PrintWriter) {
        writer.print("HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Tablet-PIN, pin\r\nAccess-Control-Max-Age: 86400\r\nConnection: close\r\n\r\n")
        writer.flush()
    }

    private fun sendHeaderResponse(writer: PrintWriter, contentType: String, length: Int) {
        writer.print("HTTP/1.1 200 OK\r\nContent-Type: $contentType\r\nContent-Length: $length\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n")
        writer.flush()
    }

    private fun sendHtmlResponse(writer: PrintWriter, html: String) {
        val bytes = html.toByteArray(Charsets.UTF_8)
        writer.print("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: no-cache, no-store, must-revalidate\r\nConnection: close\r\n\r\n")
        writer.print(html); writer.flush()
    }

    private fun sendJsonResponse(writer: PrintWriter, json: String) = sendJsonResponse(writer, 200, "OK", json)

    private fun sendErrorResponse(writer: PrintWriter, status: Int, code: String, message: String) {
        val reason = when (status) { 400 -> "Bad Request"; 401 -> "Unauthorized"; 404 -> "Not Found"; 413 -> "Payload Too Large"; 501 -> "Not Implemented"; else -> "Error" }
        sendJsonResponse(writer, status, reason, JSONObject().apply { put("ok", false); put("error", code); put("message", message) }.toString())
    }

    private fun sendJsonResponse(writer: PrintWriter, status: Int, reason: String, json: String) {
        val bytes = json.toByteArray(Charsets.UTF_8)
        writer.print("HTTP/1.1 $status $reason\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Tablet-PIN, pin\r\nCache-Control: no-cache, no-store, must-revalidate\r\nConnection: close\r\n\r\n")
        writer.print(json); writer.flush()
    }
}
