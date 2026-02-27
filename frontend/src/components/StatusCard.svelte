<script lang="ts">
  interface Props {
    label: string;
    status: "ok" | "error" | "timeout" | "warning" | "unknown";
    value?: string | null;
    sub?: string | null;
    updatedAt?: number | null;
  }

  const { label, status, value = null, sub = null, updatedAt = null }: Props = $props();

  function timeAgo(ts: number | null): string {
    if (!ts) return "never";
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return "just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  const statusColors: Record<string, string> = {
    ok: "#22c55e",
    error: "#ef4444",
    timeout: "#f97316",
    warning: "#eab308",
    unknown: "#6b7280",
  };
</script>

<div class="card" style="--accent: {statusColors[status]}">
  <div class="header">
    <span class="dot"></span>
    <span class="label">{label}</span>
  </div>
  {#if value}
    <div class="value">{value}</div>
  {/if}
  {#if sub}
    <div class="sub">{sub}</div>
  {/if}
  <div class="time">{timeAgo(updatedAt)}</div>
</div>

<style>
  .card {
    background: #1e2030;
    border: 1px solid #2a2d3e;
    border-left: 3px solid var(--accent);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 160px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
    box-shadow: 0 0 6px var(--accent);
  }

  .label {
    font-size: 12px;
    color: #9ca3af;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .value {
    font-size: 18px;
    font-weight: 700;
    color: #f1f5f9;
    font-variant-numeric: tabular-nums;
  }

  .sub {
    font-size: 11px;
    color: #6b7280;
  }

  .time {
    font-size: 10px;
    color: #4b5563;
    margin-top: 2px;
  }
</style>
