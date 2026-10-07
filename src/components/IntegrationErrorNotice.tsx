"use client";

import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

export function IntegrationErrorNotice({ error, hasData, retry }: { error: unknown; hasData: boolean; retry: () => void }) {
  const { lang } = useTranslation();
  if (!error) return null;
  const copy = {
    ru: ["Не удалось обновить данные сервиса.", "Показаны последние загруженные данные.", "Повторить", "Восстановить вход"],
    uk: ["Не вдалося оновити дані сервісу.", "Показано останні завантажені дані.", "Повторити", "Відновити вхід"],
    sk: ["Údaje sa nepodarilo aktualizovať.", "Zobrazujú sa posledné načítané údaje.", "Skúsiť znova", "Prihlásiť sa znova"],
    en: ["Could not update service data.", "Showing the last loaded data.", "Retry", "Sign in again"],
  }[lang];
  return <div className="integration-error-notice" role="alert"><p>{copy[0]} {hasData ? copy[1] : ""}</p><button type="button" onClick={retry}>{copy[2]}</button> <Link href="/?reason=session_expired">{copy[3]}</Link></div>;
}
