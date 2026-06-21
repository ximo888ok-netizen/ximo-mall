/**
 * Ximo Mall MCP Server - HTTP Entry Point
 *
 * Provides an HTTP interface for the MCP protocol (Streamable HTTP transport)
 * along with a built-in Web UI for interacting with the server.
 *
 * Usage:
 *   npx tsx src/http.ts
 *   # or via npm script:
 *   npm run start:http
 *
 * Environment variables:
 *   PORT - Server port (default: 3001)
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBananaMallMcpServer } from "./server.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3001;
const UI_DIR = path.resolve(__dirname, "..", "ui");

// ---------------------------------------------------------------------------
// Web UI HTML
// ---------------------------------------------------------------------------

const WEB_UI_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ximo Mall MCP Server</title>
  <style>
    :root {
      --bg: #0f0f0f;
      --surface: #1a1a2e;
      --surface-hover: #16213e;
      --border: #333;
      --text: #e0e0e0;
      --text-muted: #888;
      --accent: #f5c518;
      --accent-hover: #d4a913;
      --success: #4caf50;
      --error: #f44336;
      --info: #2196f3;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    header h1 {
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--accent);
    }
    header .status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    header .status .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
    }
    header .status.disconnected .dot {
      background: var(--error);
    }
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      max-width: 960px;
      width: 100%;
      margin: 0 auto;
      padding: 1.5rem 2rem;
    }
    .endpoint-bar {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .endpoint-bar .method {
      background: var(--accent);
      color: #000;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }
    .endpoint-bar code {
      color: var(--text);
      font-size: 0.9rem;
    }
    .controls {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    button {
      font-family: inherit;
      font-size: 0.85rem;
      padding: 0.5rem 1rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      transition: all 0.15s;
    }
    button:hover {
      background: var(--surface-hover);
      border-color: var(--accent);
    }
    button.primary {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
      font-weight: 600;
    }
    button.primary:hover {
      background: var(--accent-hover);
    }
    .request-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    textarea {
      width: 100%;
      min-height: 200px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      color: var(--text);
      font-family: inherit;
      font-size: 0.85rem;
      resize: vertical;
      outline: none;
    }
    textarea:focus {
      border-color: var(--accent);
    }
    .response-area {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      min-height: 200px;
      max-height: 400px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    .response-area.success { border-color: var(--success); }
    .response-area.error { border-color: var(--error); color: var(--error); }
    .log-panel {
      margin-top: 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      max-height: 200px;
      overflow-y: auto;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .log-panel .log-entry { margin-bottom: 0.25rem; }
    .log-panel .log-entry.error { color: var(--error); }
    .log-panel .log-entry.info { color: var(--info); }
  </style>
</head>
<body>
  <header>
    <h1>Ximo Mall MCP Server</h1>
    <div class="status" id="status">
      <span class="dot"></span>
      <span id="statusText">Connected</span>
    </div>
  </header>
  <main>
    <div class="endpoint-bar">
      <span class="method">POST</span>
      <code>/mcp</code>
    </div>
    <div class="controls">
      <button class="primary" onclick="sendRequest()">Send Request</button>
      <button onclick="loadToolsList()">List Tools</button>
      <button onclick="clearResponse()">Clear</button>
    </div>
    <div class="request-area">
      <textarea id="requestBody" placeholder="Enter MCP JSON-RPC request...">{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": {},
    "clientInfo": {
      "name": "ximo-mall-web-ui",
      "version": "1.0.0"
    }
  }
}</textarea>
      <div class="response-area" id="responseArea">
        Response will appear here...
      </div>
    </div>
    <div class="log-panel" id="logPanel"></div>
  </main>
  <script>
    const endpoint = '/mcp';
    let sessionId = null;

    function log(msg, type = 'info') {
      const panel = document.getElementById('logPanel');
      const entry = document.createElement('div');
      entry.className = 'log-entry ' + type;
      entry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
      panel.appendChild(entry);
      panel.scrollTop = panel.scrollHeight;
    }

    async function sendRequest() {
      const body = document.getElementById('requestBody').value;
      const responseArea = document.getElementById('responseArea');
      responseArea.textContent = 'Sending...';
      responseArea.className = 'response-area';

      try {
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        };
        if (sessionId) {
          headers['Mcp-Session-Id'] = sessionId;
        }

        log('Sending request to ' + endpoint);
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers,
          body
        });

        // Capture session ID from response headers
        const newSessionId = resp.headers.get('Mcp-Session-Id');
        if (newSessionId) {
          sessionId = newSessionId;
          log('Session ID: ' + sessionId);
        }

        const contentType = resp.headers.get('content-type') || '';
        let text;
        if (contentType.includes('text/event-stream')) {
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let result = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            result += decoder.decode(value, { stream: true });
          }
          text = result;
        } else {
          text = await resp.text();
        }

        responseArea.textContent = text;
        responseArea.className = 'response-area ' + (resp.ok ? 'success' : 'error');
        log('Response: ' + resp.status, resp.ok ? 'info' : 'error');
      } catch (err) {
        responseArea.textContent = 'Error: ' + err.message;
        responseArea.className = 'response-area error';
        log('Error: ' + err.message, 'error');
      }
    }

    async function loadToolsList() {
      document.getElementById('requestBody').value = JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/list',
        params: {}
      }, null, 2);
      await sendRequest();
    }

    function clearResponse() {
      document.getElementById('responseArea').textContent = 'Response will appear here...';
      document.getElementById('responseArea').className = 'response-area';
    }

    log('Ximo Mall MCP Web UI ready');
  </script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Transport management for Streamable HTTP
// ---------------------------------------------------------------------------

interface TransportEntry {
  transport: StreamableHTTPServerTransport;
  server: ReturnType<typeof createBananaMallMcpServer>;
}

const transports = new Map<string, TransportEntry>();

async function handleMcpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  // Parse body
  const body = await readBody(req);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // Check if this is an initialize request or if we need to find existing transport
  if (sessionId && transports.has(sessionId)) {
    // Existing session
    const entry = transports.get(sessionId)!;
    await entry.transport.handleRequest(req, res, parsed as object);
    return;
  }

  // New session with initialize request
  if (!Array.isArray(parsed) && isInitializeRequest(parsed)) {
    const server = createBananaMallMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,  // Enable JSON response mode for better compatibility
      onsessionclosed: (closedSessionId) => {
        // Clean up
        transports.delete(closedSessionId);
        process.stderr.write(
          `[ximo-mall-mcp] Session ${closedSessionId} closed.\n`,
        );
      },
    });

    await server.connect(transport);
    // IMPORTANT: sessionId is set DURING handleRequest (by the transport itself),
    // so handleRequest must be called BEFORE storing in the map.
    await transport.handleRequest(req, res, parsed as object);

    if (transport.sessionId) {
      transports.set(transport.sessionId, { transport, server });
      process.stderr.write(
        `[ximo-mall-mcp] New session: ${transport.sessionId}\n`,
      );
    }
    return;
  }

  // No valid session or non-initialize request without session
  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: "Bad Request: invalid or missing session for non-initialize request",
    }),
  );
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function serveStaticFile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  urlPath: string,
): boolean {
  // Normalize and prevent directory traversal
  const safePath = path
    .normalize(urlPath)
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(UI_DIR, safePath);

  if (!filePath.startsWith(UI_DIR)) {
    return false;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentType });
  res.end(content);
  return true;
}

// ---------------------------------------------------------------------------
// CORS helper
// ---------------------------------------------------------------------------

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Mcp-Session-Id, Last-Event-ID",
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // MCP endpoint
  if (pathname === "/mcp") {
    if (req.method === "POST" || req.method === "GET") {
      try {
        await handleMcpRequest(req, res);
      } catch (err) {
        process.stderr.write(
          `[ximo-mall-mcp] Error handling MCP request: ${err instanceof Error ? err.message : String(err)}\n`,
        );
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      }
      return;
    }
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  // SSE endpoint for GET /mcp (server-initiated notifications)
  if (pathname === "/mcp" && req.method === "GET") {
    // This is handled by the StreamableHTTP transport internally
    // For GET, the transport sets up an SSE stream
    try {
      await handleMcpRequest(req, res);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
    return;
  }

  // Web UI - serve index.html at root
  if (pathname === "/" || pathname === "/index.html") {
    // Check if a custom UI file exists
    const customIndex = path.join(UI_DIR, "index.html");
    if (fs.existsSync(customIndex)) {
      if (serveStaticFile(req, res, "/index.html")) return;
    }
    // Serve built-in Web UI
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(WEB_UI_HTML);
    return;
  }

  // Static files from ui/ directory (support both /ui/ prefix and direct paths)
  if (pathname.startsWith("/ui/")) {
    const uiPath = pathname.slice(4);
    if (serveStaticFile(req, res, uiPath)) return;
  }
  // Also serve static assets referenced from index.html (css/js/images)
  const ext = path.extname(pathname).toLowerCase();
  if (ext && ext !== '.html') {
    if (serveStaticFile(req, res, pathname)) return;
  }

  // Health check
  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "ximo-mall-mcp-server",
        sessions: transports.size,
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  const msg = [
    `[ximo-mall-mcp] HTTP server running on http://localhost:${PORT}`,
    `[ximo-mall-mcp] MCP endpoint: POST http://localhost:${PORT}/mcp`,
    `[ximo-mall-mcp] Web UI: http://localhost:${PORT}/`,
    `[ximo-mall-mcp] Health: http://localhost:${PORT}/health`,
  ].join("\n");
  process.stderr.write(msg + "\n");
});

// Graceful shutdown
process.on("SIGINT", () => {
  process.stderr.write("[ximo-mall-mcp] Shutting down...\n");
  server.close(() => {
    process.exit(0);
  });
  // Force exit after 5 seconds
  setTimeout(() => process.exit(1), 5000);
});

process.on("SIGTERM", () => {
  process.stderr.write("[ximo-mall-mcp] Received SIGTERM, shutting down...\n");
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
});
