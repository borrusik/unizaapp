"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
import { dictionaries, type Lang, type TranslationKey } from "@/locales";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: TranslationKey) => any;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectBrowserLanguage(): Lang {
  if (typeof window === "undefined") return "sk";
  try {
    const savedLang = localStorage.getItem("uniza_lang") as Lang | null;
    if (savedLang && ["sk", "en", "uk", "ru"].includes(savedLang)) {
      return savedLang;
    }
    const navAny = navigator as unknown as { userLanguage?: string };
    const userLang = navigator.language || navAny.userLanguage || "sk";
    if (userLang.startsWith("uk")) return "uk";
    if (userLang.startsWith("ru")) return "ru";
    if (userLang.startsWith("en")) return "en";
  } catch {
    // fallback
  }
  return "sk";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("sk");

  useEffect(() => {
    const detected = detectBrowserLanguage();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLangState(detected);

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Lang>;
      if (customEvent.detail && ["sk", "en", "uk", "ru"].includes(customEvent.detail)) {
        setLangState(customEvent.detail);
      }
    };

    window.addEventListener("unizaLanguageChange", handleCustomEvent);
    return () => window.removeEventListener("unizaLanguageChange", handleCustomEvent);
  }, []);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    try {
      localStorage.setItem("uniza_lang", newLang);
      window.dispatchEvent(new CustomEvent("unizaLanguageChange", { detail: newLang }));
    } catch {
      // ignore storage errors
    }
  };

  const value = useMemo<LanguageContextValue>(() => ({
    lang,
    setLang,
    t: (key: TranslationKey) => {
      const dict = dictionaries[lang] || dictionaries.sk;
      return dict[key] ?? dictionaries.sk[key] ?? key;
    },
  }), [lang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      lang: "sk",
      setLang: () => {},
      t: (key: TranslationKey) => dictionaries.sk[key] ?? key,
    };
  }
  return context;
}
