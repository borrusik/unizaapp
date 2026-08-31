"use client";

import { useTranslation, type Lang } from "@/hooks/useTranslation";

export function LanguageSwitcher() {
  const { t, lang, setLang } = useTranslation();

  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ marginBottom: "8px", padding: "0 4px" }}>
        <span className="label">{t("settings_language")}</span>
      </div>
      <div className="card-group">
        {(["sk", "en", "uk", "ru"] as Lang[]).map((l) => (
          <button
            type="button"
            key={l}
            onClick={() => setLang(l)}
            autoFocus={false}
            aria-pressed={lang === l}
            className="card-row"
            style={{
              width: "100%",
              textAlign: "left",
              outline: "none",
              border: "none",
              background: "var(--surface)",
              color: lang === l ? "var(--primary)" : "var(--text-primary)",
            }}
          >
            <span className="text-sm" style={{ fontWeight: lang === l ? 700 : 500, color: "inherit" }}>
              {t(`lang_${l}` as keyof typeof import("@/hooks/useTranslation").dictionary.sk)}
            </span>
            {lang === l && (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
