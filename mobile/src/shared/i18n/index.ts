import { useSyncExternalStore } from 'react';
import { en, fr } from './messages';

export type Language = 'fr' | 'en';
const STORAGE_KEY = 'life-organizer.language';
let explicitPreference = false;
function storedLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    explicitPreference = stored === 'fr' || stored === 'en';
    return stored === 'en' ? 'en' : 'fr';
  }
  catch { return 'fr'; }
}
let language: Language = storedLanguage();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getLanguage = () => language;
export const hasLanguagePreference = () => explicitPreference;
export function setLanguage(next: Language) {
  explicitPreference = true;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Language still works when browser storage is unavailable. */ }
  if (next === language) return;
  language = next;
  syncDocumentLanguage();
  listeners.forEach(listener => listener());
}
/** Source phrases are translation keys; only explicitly marked interface copy is translated. */
export function t(source: string, values: Record<string, unknown> = {}): string {
  const message = (language === 'en' ? en[source] : fr[source]) ?? source;
  return message.replace(/\{(\w+)\}/g, (match, key: string) => Object.hasOwn(values, key) ? String(values[key]) : match);
}
export function useI18n() {
  const language = useSyncExternalStore(subscribe, getLanguage, () => 'fr' as const);
  return { language, t, setLanguage };
}
function syncDocumentLanguage() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.title = 'Entre Nous';
  const description = t('Nos mots, nos moments, notre quotidien.');
  for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
    document.querySelector(selector)?.setAttribute('content', description);
  }
}
syncDocumentLanguage();
