"use client";

import { useTransition, useState } from "react";
import { login } from "@/lib/scraper";
import { useTranslation } from "@/hooks/useTranslation";
import { AppIcon } from "@/components/AppIcon";

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Remove legacy personal-data caches while preserving language and theme preferences.
    try {
      [
        "uniza_subjects_cache",
        "uniza_schedule_cache",
        "uniza_grades_cache",
        "uniza_user_info",
        "uniza_user_cache",
        "uniza_strava_info",
        "uniza_strava_menu",
        "uniza_strava_history",
      ].forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore errors if any
    }

    startTransition(async () => {
      const result = await login(formData);
      if (result.error) {
        setError(result.error);
      } else {
        // A full navigation clears SWR's in-memory cache so a new login can
        // never inherit subjects, grades, or a selected year from the prior session.
        window.history.scrollRestoration = "manual";
        window.scrollTo(0, 0);
        window.location.replace("/dashboard");
      }
    });
  };

  return (
    <main className="login-shell">
      <div className="login-content">
        <header className="login-header animate-slide-up">
          <div className="login-brand" aria-hidden="true">UŽ</div>
          <p className="login-university">{t("login_subtitle")}</p>
          <h1>{t("login_title")}</h1>
        </header>

        <form className="login-form animate-fade-in" onSubmit={handleLogin} method="post">
          <div className="input-group">
            <label className="input-label" htmlFor="email">{t("login_email")}</label>
            <input
              type="email"
              id="email"
              name="email"
              className="input-field"
              placeholder="meno@stud.uniza.sk"
              required
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password">{t("login_password")}</label>
            <input
              type="password"
              id="password"
              name="password"
              className="input-field"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <label className="login-remember">
            <input type="hidden" name="remember" value="off" />
            <input type="checkbox" name="remember" value="on" defaultChecked />
            <span className="login-remember-box"><AppIcon name="check" size={15} /></span>
            <span><strong>{t("login_password_saved")}</strong><small>{t("login_safe_msg")}</small></span>
          </label>

          {error && <div role="alert" className="login-error">{error}</div>}

          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? (
              <span className="login-loading">
                <span className="login-spinner" />
                {t("login_loading")}
              </span>
            ) : t("login_button")}
          </button>
        </form>

        <div className="login-meta animate-fade-in">
          <a
            href="https://www.instagram.com/borrusik/"
            target="_blank"
            rel="noopener noreferrer"
            className="support-link"
          >
            <span className="support-link-icon"><AppIcon name="instagram" size={23} /></span>
            <span className="support-link-copy">
              <strong>{t("support_instagram")}</strong>
              <small>{t("support_instagram_hint")}</small>
            </span>
            <AppIcon name="external-link" size={17} />
          </a>

          <div className="login-footer-links">
            <a href="https://github.com/borrusik/unizaapp" target="_blank" rel="noopener noreferrer">
              {t("login_open_source")}
            </a>
            <span aria-hidden="true">·</span>
            <span>{t("login_terms")}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
