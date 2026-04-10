// frontend/src/lib/i18n/ru.ts
const ru = {
  'ui.loading': 'Загрузка...',
  'ui.updated': 'Обновлено {n}с назад',
} as const;

export type TranslationKey = keyof typeof ru;
export default ru as Record<TranslationKey, string>;
