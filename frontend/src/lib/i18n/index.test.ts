// Globals must be set BEFORE module import
const mockStore: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (k: string) => mockStore[k] ?? null,
  setItem: (k: string, v: string) => { mockStore[k] = v; },
  removeItem: (k: string) => { delete mockStore[k]; },
  clear: () => { for (const k in mockStore) delete mockStore[k]; },
};
(global as any).navigator = { language: 'en-US' };

import { describe, test, expect, beforeEach } from 'bun:test';
import { get } from 'svelte/store';
import { locale, t, detectLocale } from './index.ts';

describe('detectLocale', () => {
  beforeEach(() => {
    for (const k in mockStore) delete mockStore[k];
    (global as any).navigator = { language: 'en-US' };
  });

  test('returns saved locale from localStorage', () => {
    mockStore['locale'] = 'ru';
    expect(detectLocale()).toBe('ru');
  });

  test('returns ru for navigator.language ru-RU', () => {
    (global as any).navigator = { language: 'ru-RU' };
    expect(detectLocale()).toBe('ru');
  });

  test('returns en for navigator.language en-US', () => {
    expect(detectLocale()).toBe('en');
  });

  test('returns en when localStorage is empty and language is not Russian', () => {
    expect(detectLocale()).toBe('en');
  });
});

type Translator = (key: string, vars?: Record<string, string | number>) => string;

describe('t()', () => {
  test('returns Russian text when locale is ru', () => {
    locale.set('ru');
    expect((get(t) as Translator)('ui.loading')).toBe('Загрузка...');
  });

  test('returns English text when locale is en', () => {
    locale.set('en');
    expect((get(t) as Translator)('ui.loading')).toBe('Loading...');
  });

  test('falls back to raw key when not found in any dict', () => {
    locale.set('en');
    expect((get(t) as Translator)('nonexistent.key.xyz')).toBe('nonexistent.key.xyz');
  });

  test('interpolates {n} variables', () => {
    locale.set('en');
    expect((get(t) as Translator)('ui.updated', { n: 42 })).toBe('Updated 42s ago');
  });

  test('persists locale change to localStorage', () => {
    for (const k in mockStore) delete mockStore[k];
    locale.set('ru');
    expect(mockStore['locale']).toBe('ru');
  });

  // Note: "falls back to RU when key missing in EN" is enforced by TypeScript
  // (en.ts typed as Record<TranslationKey, string> — missing keys won't compile).
  // The fallback is defensive code for runtime safety only, not tested here.
});
