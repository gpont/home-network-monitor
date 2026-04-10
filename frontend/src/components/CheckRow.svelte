<script lang="ts">
  import type { CheckDefinition, StatusResponse, CheckStatus } from '../lib/types.ts';

  let { check, status }: { check: CheckDefinition; status: StatusResponse } = $props();

  const statusColor: Record<CheckStatus, string> = {
    ok: '#22c55e',
    fail: '#ef4444',
    warn: '#eab308',
    stale: '#4b5563',
    unknown: '#4b5563',
    info: '#3b82f6',
  };
  const statusIcon: Record<CheckStatus, string> = {
    ok: '✓', fail: '✗', warn: '!', stale: '?', unknown: '?', info: 'i',
  };

  const st = $derived(check.getStatus(status));
  const val = $derived(check.getValue(status));
  const fix = $derived(st === 'fail' ? check.getFix(status) : null);
  const color = $derived(statusColor[st] ?? '#4b5563');
  const icon = $derived(statusIcon[st] ?? '?');
  const bg = $derived(st === 'fail' ? 'rgba(239,68,68,0.08)' : 'transparent');
</script>

<div style="padding: 6px 8px; border-radius: 6px; background: {bg}; margin-bottom: 2px;">
  <div style="display: flex; align-items: flex-start; gap: 8px;">
    <span style="
      display: inline-flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; border-radius: 50%;
      background: {color}; color: white; font-size: 11px; font-weight: bold;
      flex-shrink: 0; margin-top: 1px;
    ">{icon}</span>
    <div style="flex: 1; min-width: 0;">
      <div style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
        <span style="font-weight: 500; font-size: 13px; color: #e2e8f0;">{check.name}</span>
        {#if val}
          <span style="font-size: 12px; color: {color}; font-weight: 500;">{val}</span>
        {/if}
      </div>
      <div style="font-size: 11px; color: #64748b; margin-top: 1px;">{check.description}</div>
      {#if fix && fix.length > 0}
        <div style="margin-top: 6px; padding: 6px 8px; background: rgba(239,68,68,0.12); border-left: 2px solid #ef4444; border-radius: 3px;">
          <div style="font-size: 11px; font-weight: 600; color: #ef4444; margin-bottom: 3px;">Что делать:</div>
          {#each fix as step, i}
            <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">{i+1}. {step}</div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
