import { sk, type TranslationKey } from "./sk";
import { en } from "./en";
import { uk } from "./uk";
import { ru } from "./ru";

export type Lang = "sk" | "en" | "uk" | "ru";

export const dictionaries = {
  sk,
  en,
  uk,
  ru,
} as const;

export { sk, en, uk, ru };
export type { TranslationKey };
