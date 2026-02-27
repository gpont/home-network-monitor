<script lang="ts">
  import type { Event } from "../lib/types.ts";

  interface Props {
    events: Event[];
  }

  const { events }: Props = $props();

  const TYPE_ICONS: Record<string, string> = {
    ip_change: "🌐",
    routing_change: "🔀",
    ssl_expiring: "🔒",
  };

  function formatTs(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleString();
  }
</script>

<div class="widget">
  <div class="widget-title">Events Log</div>
  {#if events.length === 0}
    <div class="empty">No significant events recorded</div>
  {:else}
    <div class="list">
      {#each events as event}
        <div class="event">
          <span class="icon">{TYPE_ICONS[event.type] ?? "ℹ️"}</span>
          <div class="content">
            <div class="msg">{event.message}</div>
            <div class="time">{formatTs(event.timestamp)}</div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .widget {
    background: #1e2030;
    border: 1px solid #2a2d3e;
    border-radius: 8px;
    padding: 16px;
  }

  .widget-title {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 12px;
  }

  .empty { color: #4b5563; font-size: 13px; padding: 8px 0; }

  .list { display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto; }

  .event {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 8px;
    background: #252840;
    border-radius: 6px;
  }

  .icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }

  .content { flex: 1; min-width: 0; }

  .msg { font-size: 13px; color: #d1d5db; }
  .time { font-size: 11px; color: #4b5563; margin-top: 2px; }
</style>
