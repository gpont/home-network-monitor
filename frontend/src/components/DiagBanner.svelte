<script lang="ts">
  import type { DiagnosticRule } from '../lib/types.ts';

  let { rule }: { rule: DiagnosticRule } = $props();

  const severityConfig = {
    critical: { bg: 'rgba(239,68,68,0.1)', border: '#ef4444', icon: '🔴', textColor: '#fca5a5' },
    warning:  { bg: 'rgba(234,179,8,0.1)',  border: '#eab308', icon: '🟡', textColor: '#fde047' },
    info:     { bg: 'rgba(59,130,246,0.1)', border: '#3b82f6', icon: '🔵', textColor: '#93c5fd' },
  };

  const cfg = $derived(severityConfig[rule.severity]);
</script>

<div style="
  background: {cfg.bg};
  border: 1px solid {cfg.border};
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 8px;
">
  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
    <span style="font-size: 16px;">{cfg.icon}</span>
    <span style="font-weight: 600; font-size: 14px; color: #e2e8f0;">{rule.title}</span>
  </div>
  <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">{rule.description}</div>
  {#if rule.steps.length > 0}
    <div style="padding-left: 4px;">
      {#each rule.steps as step, i}
        <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 3px; display: flex; gap: 6px;">
          <span style="color: {cfg.textColor}; font-weight: 500; flex-shrink: 0;">{i+1}.</span>
          <span>{step}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>
