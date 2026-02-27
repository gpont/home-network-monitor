import { writable } from "svelte/store";
import type { WsMessage } from "./types.ts";

export const wsConnected = writable(false);
const listeners = new Map<string, Set<(data: unknown) => void>>();

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onopen = () => {
    wsConnected.set(true);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    // Keep-alive ping every 30s
    const keepalive = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send('{"type":"ping"}');
      } else {
        clearInterval(keepalive);
      }
    }, 30_000);
  };

  ws.onclose = () => {
    wsConnected.set(false);
    reconnectTimer = setTimeout(connect, 3000);
  };

  ws.onerror = () => {
    ws?.close();
  };

  ws.onmessage = (e) => {
    try {
      const msg: WsMessage = JSON.parse(e.data);
      const handlers = listeners.get(msg.event);
      if (handlers) {
        for (const fn of handlers) fn(msg.data);
      }
      // Also fire wildcard listeners
      const all = listeners.get("*");
      if (all) {
        for (const fn of all) fn(msg);
      }
    } catch {
      // ignore malformed messages
    }
  };
}

export function onWsEvent(event: string, fn: (data: unknown) => void) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(fn);
  return () => listeners.get(event)?.delete(fn);
}

// Start connecting
connect();
