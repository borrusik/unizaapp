"use client";

import { useTranslation, type Lang } from "@/hooks/useTranslation";
import { AppIcon } from "@/components/AppIcon";

export function LanguageSwitcher() {
  const { t, lang, setLang } = useTranslation();

  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ marginBottom: "8px", padding: "0 4px" }}>
        <span className="label">{t("settings_language")}</span>
      </div>
      <div className="profile-open-group">
        {(["sk", "en", "uk", "ru"] as Lang[]).map((l) => (
          <button
            type="button"
            key={l}
            onClick={() => setLang(l)}
            autoFocus={false}
            aria-pressed={lang === l}
            className="profile-open-row"
            style={{
              width: "100%",
              textAlign: "left",
              outline: "none",
              borderTop: "none",
              borderRight: "none",
              borderLeft: "none",
              background: "transparent",
              color: lang === l ? "var(--primary)" : "var(--text-primary)",
            }}
          >
            <span className="text-sm" style={{ fontWeight: lang === l ? 700 : 500, color: "inherit" }}>
              {t(`lang_${l}` as keyof typeof import("@/hooks/useTranslation").dictionary.sk)}
            </span>
            {lang === l && (
              <AppIcon name="check" size={18} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
