<script lang="ts">
  import type { CheckDefinition, StatusResponse, CheckStatus } from '../lib/types.ts';
  import CheckRow from './CheckRow.svelte';

  interface Props {
    layer: { id: number; name: string; icon: string };
    checks: CheckDefinition[];
    status: StatusResponse;
    isCascade?: boolean;
  }

  let { layer, checks, status, isCascade = false }: Props = $props();

  const statuses = $derived(checks.map(c => c.getStatus(status)));
  const failCount = $derived(statuses.filter(s => s === 'fail').length);
  const warnCount = $derived(statuses.filter(s => s === 'warn').length);
  const okCount = $derived(statuses.filter(s => s === 'ok').length);

  const borderColor = $derived(
    failCount > 0 ? '#ef4444' :
    warnCount > 0 ? '#eab308' :
    '#22c55e'
  );

  const badgeText = $derived(
    failCount > 0 ? `${failCount} errors` : `${okCount}/${checks.length} ✓`
  );
  const badgeColor = $derived(failCount > 0 ? '#ef4444' : '#22c55e');
</script>

<div
  id="layer-{layer.id}"
  style="
    background: #1e293b;
    border-radius: 8px;
    border-left: 3px solid {borderColor};
    padding: 12px 16px;
    margin-bottom: 12px;
  "
>
  {#if isCascade}
    <div style="
      font-size: 11px; color: #64748b;
      margin-bottom: 8px; padding: 4px 8px;
      background: rgba(100,116,139,0.1); border-radius: 4px;
    ">⚠ Likely cascading from an upstream layer issue</div>
  {/if}

  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
    <div style="display: flex; align-items: center; gap: 6px;">
      <span style="font-size: 16px;">{layer.icon}</span>
      <span style="font-weight: 600; font-size: 14px; color: #e2e8f0;">{layer.name}</span>
    </div>
    <span style="
      font-size: 11px; font-weight: 600; color: {badgeColor};
      background: {badgeColor}1a; padding: 2px 8px; border-radius: 10px;
    ">{badgeText}</span>
  </div>

  <div>
    {#each checks as check}
      <CheckRow {check} {status} />
    {/each}
  </div>
</div>
