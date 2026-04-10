<script lang="ts">
  import { t } from '../lib/i18n/index.ts';
  import type { CheckDefinition, StatusResponse, CheckStatus } from '../lib/types.ts';

  let { check, status, lastTimestamp = null }: { check: CheckDefinition; status: StatusResponse; lastTimestamp?: number | null } = $props();

  const statusColor: Record<CheckStatus, string> = {
    ok: '#22c55e',
    fail: '#ef4444',
    warn: '#eab308',
    stale: '#6b7280',
    unknown: '#6b7280',
  };
  const statusIcon: Record<CheckStatus, string> = {
    ok: '✓', fail: '✗', warn: '!', stale: '–', unknown: '–',
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

  // For unknown: show config hint (yellow) or generic timing text (grey)
  const hasConfigHint = $derived(st === 'unknown' && check.configHint && check.configHint.length > 0);

  // Compute ~minutes until data for unknown state
  const minutesUntilData = $derived(Math.max(1, Math.round(check.staleAfterMs / 3 / 60000)));

  // Minutes since last data for stale state
  const minutesSinceUpdate = $derived(
    lastTimestamp ? Math.max(1, Math.round((Date.now() - lastTimestamp) / 60000)) : 0
  );

  // Grey text for no-data states
  const noDataMsg = $derived(
    st === 'stale' ? $t('ui.data_stale', { n: minutesSinceUpdate }) :
    check.noDataHint ? $t(check.noDataHint) :
    $t('ui.data_in', { n: minutesUntilData })
  );

  // Run now button state
  let isRunning = $state(false);
  let runError = $state<string | null>(null);
  const showRunButton = $derived(
    (st === 'unknown' || st === 'stale') &&
    check.runnable === true &&
    !hasConfigHint
  );

  async function runNow() {
    if (!check.runType || isRunning) return;
    isRunning = true;
    runError = null;
    try {
      const res = await fetch(`/api/run/${check.runType}`, { method: 'POST' });
      if (res.status === 409) {
        runError = $t('ui.already_running');
      }
    } catch {
      runError = 'error';
    } finally {
      isRunning = false;
    }
  }
</script>

<div style="padding: 5px 8px; border-radius: 6px; background: {hasConfigHint ? 'rgba(234,179,8,0.05)' : bg}; margin-bottom: 1px;">
  <div style="display: flex; align-items: flex-start; gap: 8px;">
    <span
      title={$t(check.hint)}
      style="
        display: inline-flex; align-items: center; justify-content: center;
        width: 18px; height: 18px; border-radius: 50%;
        background: {isNoData && !hasConfigHint ? 'rgba(107,114,128,0.3)' : hasConfigHint ? '#eab308' : color};
        color: white; font-size: 10px; font-weight: bold;
        flex-shrink: 0; margin-top: 2px; cursor: help;
      ">{hasConfigHint ? '!' : icon}</span>
    <div style="flex: 1; min-width: 0;">
      <div style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
        <span
          title={$t(check.hint)}
          style="font-weight: 500; font-size: 13px; color: {isNoData && !hasConfigHint ? '#4b5563' : '#e2e8f0'}; cursor: help;"
        >{$t(check.name)}</span>
        {#if !isNoData && val}
          <span style="font-size: 12px; color: {color}; font-weight: 500;">{$t(val)}</span>
        {/if}
      </div>

      {#if hasConfigHint && check.configHint}
        <div style="font-size: 11px; color: #475569; margin-top: 1px;">{$t(check.hint)}</div>
        <div style="margin-top: 5px; padding: 5px 8px;
          background: rgba(234,179,8,0.1); border-left: 2px solid #eab308; border-radius: 3px;">
          <div style="font-size: 11px; font-weight: 600; color: #eab308; margin-bottom: 3px;">{$t('ui.needs_config')}</div>
          {#each check.configHint as key, i}
            <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">{i + 1}. {$t(key)}</div>
          {/each}
        </div>
      {:else if isNoData}
        <div style="font-size: 11px; color: #374151; margin-top: 1px; font-style: italic;">{noDataMsg}</div>
        {#if showRunButton}
          <div style="margin-top: 5px;">
            {#if isRunning}
              <span style="font-size: 11px; color: #3b82f6; font-style: italic;">{$t('ui.running')}</span>
            {:else if runError}
              <span style="font-size: 11px; color: #6b7280; font-style: italic;">{runError}</span>
            {:else}
              <button
                onclick={runNow}
                style="background: #1e3a5f; border: 1px solid #2563eb; color: #60a5fa;
                  font-size: 11px; border-radius: 4px; padding: 3px 10px;
                  cursor: pointer; font-family: inherit;"
              >{$t('ui.run_now')}</button>
            {/if}
          </div>
        {/if}
      {:else}
        <div style="font-size: 11px; color: #475569; margin-top: 1px;">{$t(check.hint)}</div>
      {/if}

      {#if fix && fix.length > 0}
        <div style="margin-top: 5px; padding: 5px 8px;
          background: {st === 'warn' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)'};
          border-left: 2px solid {st === 'warn' ? '#eab308' : '#ef4444'};
          border-radius: 3px;">
          <div style="font-size: 11px; font-weight: 600; color: {st === 'warn' ? '#eab308' : '#ef4444'}; margin-bottom: 3px;">{$t('ui.what_to_do')}</div>
          {#each fix as key, i}
            <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 2px;">{i + 1}. {$t(key)}</div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
