"use client";

import { useTranslation } from "@/hooks/useTranslation";

export function GradeAverageLabel({ source }: { source: "aivs" | "personal" | "graded" }) {
  const { lang } = useTranslation();
  const copy = {
    ru: { aivs: "Средний AIVS", personal: "Личный расчёт", graded: "Средний по выставленным оценкам" },
    uk: { aivs: "Середній AIVS", personal: "Особистий розрахунок", graded: "Середній за виставленими оцінками" },
    sk: { aivs: "Priemer AIVS", personal: "Osobný výpočet", graded: "Priemer zo zadaných známok" },
    en: { aivs: "AIVS average", personal: "Personal estimate", graded: "Average of recorded grades" },
  }[lang];
  return <>{copy[source]}</>;
}
