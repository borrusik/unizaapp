"use client";

import { useLanguage } from "@/context/LanguageContext";
import { dictionaries, type Lang, type TranslationKey } from "@/locales";

export type { Lang, TranslationKey };
export const dictionary = dictionaries;

export function useTranslation() {
  const { t, lang, setLang } = useLanguage();
  return { t, lang, setLang };
}
