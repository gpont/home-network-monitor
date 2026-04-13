import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { initDb } from "./db/client.ts";
import { api } from "./routes/api.ts";
import { loadConfig } from "./config.ts";
import { startScheduler } from "./scheduler.ts";

const config = loadConfig();

initDb();

const app = new Hono();

app.use("*", cors());

// API routes
app.route("/api", api);

// Serve Svelte frontend static files
app.use("/*", serveStatic({ root: "./public" }));
app.get("/*", serveStatic({ path: "./public/index.html" }));

// ─── WebSocket setup ──────────────────────────────────────────────────────────
const wsClients = new Set<{ send: (data: string) => void; readyState: number }>();

function broadcast(event: string, data: unknown) {
  const message = JSON.stringify({ event, data, timestamp: Date.now() });
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch {
        wsClients.delete(client);
      }
    }
  }
}

const server = Bun.serve({
  port: config.port,
  hostname: "0.0.0.0",
  fetch(req, server) {
    // Upgrade WebSocket connections
    if (req.headers.get("upgrade") === "websocket") {
      const success = server.upgrade(req);
      if (success) return undefined;
      return new Response("WebSocket upgrade failed", { status: 500 });
    }
    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      wsClients.add(ws);
      console.log(`[ws] Client connected (total: ${wsClients.size})`);
    },
    close(ws) {
      wsClients.delete(ws);
      console.log(`[ws] Client disconnected (total: ${wsClients.size})`);
    },
    message(ws, message) {
      // Clients can send { type: 'ping' } to keep alive
      if (message === '{"type":"ping"}') {
        ws.send('{"type":"pong"}');
      }
    },
  },
});

console.log(`[server] Listening on http://localhost:${config.port}`);

// Start all monitoring checks
await startScheduler(config, broadcast);
