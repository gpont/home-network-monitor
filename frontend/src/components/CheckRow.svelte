<script lang="ts">
  import type { CheckDefinition, StatusResponse, CheckStatus } from '../lib/types.ts';

  let { check, status }: { check: CheckDefinition; status: StatusResponse } = $props();

  const statusColor: Record<CheckStatus, string> = {
    ok: '#22c55e',
    fail: '#ef4444',
    warn: '#eab308',
    stale: '#6b7280',
    unknown: '#6b7280',
    info: '#3b82f6',
  };
  const statusIcon: Record<CheckStatus, string> = {
    ok: '✓', fail: '✗', warn: '!', stale: '–', unknown: '–', info: 'i',
  };

  const st = $derived(check.getStatus(status));
  const val = $derived(check.getValue(status));
  const fix = $derived((st === 'fail' || st === 'warn') ? check.getFix(status) : null);
  const color = $derived(statusColor[st] ?? '#6b7280');
  const icon = $derived(statusIcon[st] ?? '–');
  const isNoData = $derived(st === 'unknown' || st === 'stale');
  const bg = $derived(
    st === 'fail' ? 'rgba(239,68,68,0.06)' :
    st === 'warn' ? 'rgba(234,179,8,0.05)' :
    'transparent'
  );
  const noDataMsg = $derived(
    st === 'stale' ? 'данные устарели' :
    check.noDataHint ?? 'данные пока не получены'
  );
</script>

<div style="padding: 5px 8px; border-radius: 6px; background: {bg}; margin-bottom: 1px;">
  <div style="display: flex; align-items: flex-start; gap: 8px;">
    <span
      title={check.hint}
      style="
        display: inline-flex; align-items: center; justify-content: center;
        width: 18px; height: 18px; border-radius: 50%;
        background: {isNoData ? 'rgba(107,114,128,0.3)' : color};
        color: white; font-size: 10px; font-weight: bold;
        flex-shrink: 0; margin-top: 2px; cursor: help;
      ">{icon}</span>
    <div style="flex: 1; min-width: 0;">
      <div style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
        <span
          title={check.hint}
          style="font-weight: 500; font-size: 13px; color: {isNoData ? '#4b5563' : '#e2e8f0'}; cursor: help;"
        >{check.name}</span>
        {#if !isNoData && val}
          <span style="font-size: 12px; color: {color}; font-weight: 500;">{val}</span>
        {/if}
      </div>
      {#if isNoData}
        <div style="font-size: 11px; color: #374151; margin-top: 1px; font-style: italic;">{noDataMsg}</div>
      {:else}
        <div style="font-size: 11px; color: #475569; margin-top: 1px;">{check.hint}</div>
      {/if}
      {#if fix && fix.length > 0}
        <div style="margin-top: 5px; padding: 5px 8px;
          background: {st === 'warn' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)'};
          border-left: 2px solid {st === 'warn' ? '#eab308' : '#ef4444'};
          border-radius: 3px;">
          <div style="font-size: 11px; font-weight: 600; color: {st === 'warn' ? '#eab308' : '#ef4444'}; margin-bottom: 3px;">Что делать:</div>
          {#each fix as step, i}
            <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">{i+1}. {step}</div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
