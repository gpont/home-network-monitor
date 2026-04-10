// frontend/src/lib/i18n/index.ts
import { writable, derived, type Readable } from 'svelte/store';
import ru from './ru.ts';
import en from './en.ts';

export type Locale = 'ru' | 'en';

export function detectLocale(): Locale {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('locale') as Locale;
    if (saved === 'ru' || saved === 'en') return saved;
  }
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ru')) {
    return 'ru';
  }
  return 'en';
}

export const locale = writable<Locale>(detectLocale());

locale.subscribe(l => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('locale', l);
  }
});

const dicts: Record<Locale, Record<string, string>> = { ru, en };

export const t: Readable<(key: string, vars?: Record<string, string | number>) => string> = derived(locale, $locale =>
  (key: string, vars?: Record<string, string | number>): string => {
    let text = dicts[$locale][key] ?? dicts['ru'][key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  }
);
