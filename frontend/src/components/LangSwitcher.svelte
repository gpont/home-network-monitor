<script lang="ts">
  import { locale, type Locale } from '../lib/i18n/index.ts';

  function set(l: Locale) { locale.set(l); }
</script>

<div class="lang-switcher">
  <button class:active={$locale === 'ru'} onclick={() => set('ru')}>🇷🇺 RU</button>
  <button class:active={$locale === 'en'} onclick={() => set('en')}>🇬🇧 EN</button>
</div>

<style>
  .lang-switcher {
    display: flex;
    border-radius: 6px;
    background: #2a2d3e;
    overflow: hidden;
  }

  button {
    padding: 3px 9px;
    border: none;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    background: transparent;
    color: #6b7280;
    font-family: inherit;
    transition: background 0.15s, color 0.15s;
  }

  button.active {
    background: #374151;
    color: #f1f5f9;
  }

  button:hover:not(.active) {
    color: #94a3b8;
  }
</style>
