"use client";

import { useTranslation, dictionary } from "@/hooks/useTranslation";

export function ClientText({ n }: { n: keyof typeof dictionary.sk }) {
  const { t } = useTranslation();
  return <>{t(n)}</>;
}
