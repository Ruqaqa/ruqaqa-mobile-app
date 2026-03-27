import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import en from './en';
import ar from './ar';

const LANGUAGE_KEY = 'app_language';

export const supportedLanguages = ['en', 'ar'] as const;
export type Language = (typeof supportedLanguages)[number];

function getDeviceLanguage(): Language {
  const locale = getLocales()[0]?.languageCode ?? 'en';
  return supportedLanguages.includes(locale as Language)
    ? (locale as Language)
    : 'en';
}

export async function getSavedLanguage(): Promise<Language | null> {
  const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (saved && supportedLanguages.includes(saved as Language)) {
    return saved as Language;
  }
  return null;
}

export async function saveLanguage(lang: Language): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
}

export async function initI18n(): Promise<void> {
  const saved = await getSavedLanguage();
  const lang = saved ?? getDeviceLanguage();

  await i18next.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    lng: lang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

  applyRTL(lang);
}

export async function changeLanguage(lang: Language): Promise<void> {
  await i18next.changeLanguage(lang);
  await saveLanguage(lang);
  applyRTL(lang);
}

function applyRTL(lang: Language) {
  const isRTL = lang === 'ar';
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);
  }
}

export function isRTL(): boolean {
  return i18next.language === 'ar';
}

export { i18next };
