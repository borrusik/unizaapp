"use client";

import { Suspense, useTransition, useState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/lib/scraper";
import { useTranslation } from "@/hooks/useTranslation";
import { AppIcon } from "@/components/AppIcon";
import { KharkivEasterEgg } from "@/components/KharkivEasterEgg";
import { safeDashboardReturnPath } from "@/lib/auth-state";

function LoginContent() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const { t, lang } = useTranslation();
  const sessionExpired = searchParams.get("reason") === "session_expired";
  const copy = lang === "sk"
    ? { eyebrow: "Neoficiálny študentský portál", hero: "Tvoj deň na univerzite, bez zbytočného hľadania.", intro: "Rozvrh, známky, skúšky, jedáleň aj pošta na jednom pokojnom mieste.", welcome: "Vitaj späť", lead: "Použi svoje univerzitné prihlasovacie údaje.", expired: "Tvoje prihlásenie vypršalo. Prihlás sa znova a vrátime ťa tam, kde si skončil.", featureSchedule: "Aktuálny rozvrh", featureGrades: "Známky a skúšky", featureMail: "Pošta a jedáleň", independent: "Vytvorené študentom pre študentov. Nie je to oficiálna aplikácia UNIZA.", secure: "Údaje posielame priamo do systémov UNIZA." }
    : lang === "en"
      ? { eyebrow: "Independent student portal", hero: "Your university day, without the searching.", intro: "Schedule, grades, exams, canteen and mail in one calm place.", welcome: "Welcome back", lead: "Use your university account to continue.", expired: "Your session expired. Sign in again and we will return you to where you stopped.", featureSchedule: "Current schedule", featureGrades: "Grades and exams", featureMail: "Mail and canteen", independent: "Built by a student for students. This is not an official UNIZA app.", secure: "Credentials are sent directly to UNIZA systems." }
      : lang === "uk"
        ? { eyebrow: "Незалежний студентський портал", hero: "Твій день в університеті — без зайвих пошуків.", intro: "Розклад, оцінки, іспити, їдальня та пошта в одному місці.", welcome: "З поверненням", lead: "Увійди за допомогою університетського акаунта.", expired: "Сеанс завершився. Увійди ще раз — ми повернемо тебе на попередню сторінку.", featureSchedule: "Актуальний розклад", featureGrades: "Оцінки та іспити", featureMail: "Пошта та їдальня", independent: "Створено студентом для студентів. Це не офіційний застосунок UNIZA.", secure: "Дані передаються безпосередньо системам UNIZA." }
        : { eyebrow: "Независимый студенческий портал", hero: "Твой день в университете — без лишних поисков.", intro: "Расписание, оценки, экзамены, столовая и почта в одном месте.", welcome: "С возвращением", lead: "Войди с помощью университетского аккаунта.", expired: "Сессия закончилась. Войди ещё раз — мы вернём тебя на предыдущую страницу.", featureSchedule: "Актуальное расписание", featureGrades: "Оценки и экзамены", featureMail: "Почта и столовая", independent: "Создано студентом для студентов. Это не официальное приложение UNIZA.", secure: "Данные передаются напрямую системам UNIZA." };

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
        window.location.replace(safeDashboardReturnPath(searchParams.get("next")));
      }
    });
  };

  return (
    <main className="login-shell">
      <div className="login-layout">
        <section className="login-story animate-slide-up" aria-label={copy.eyebrow}>
          <div className="login-wordmark">
            <KharkivEasterEgg />
            <span><strong>UNIZA Student</strong><small>{copy.eyebrow}</small></span>
          </div>
          <div className="login-story-copy">
            <span className="login-kicker">{t("login_subtitle")}</span>
            <h1>{copy.hero}</h1>
            <p>{copy.intro}</p>
            <div className="login-feature-list">
              <span><AppIcon name="calendar" size={18} />{copy.featureSchedule}</span>
              <span><AppIcon name="award" size={18} />{copy.featureGrades}</span>
              <span><AppIcon name="mail" size={18} />{copy.featureMail}</span>
            </div>
          </div>
          <p className="login-independent">{copy.independent}</p>
        </section>

        <section className="login-panel animate-fade-in">
          <div className="login-mobile-wordmark">
            <KharkivEasterEgg iconSize={24} />
            <span><strong>UNIZA Student</strong><small>{copy.eyebrow}</small></span>
          </div>
          <div className="login-card">
            <header className="login-card-header">
              <p>{t("login_subtitle")}</p>
              <h2>{copy.welcome}</h2>
              <span>{copy.lead}</span>
            </header>

            {sessionExpired && (
              <div role="status" className="login-session-notice">
                <AppIcon name="refresh" size={19} />
                <span>{copy.expired}</span>
              </div>
            )}

            <form className="login-form" onSubmit={handleLogin} method="post">
          <div className="input-group">
            <label className="input-label" htmlFor="email">{t("login_email")}</label>
            <div className="login-input-wrap"><AppIcon name="mail" size={19} /><input type="email" id="email" name="email" className="input-field" placeholder="meno@stud.uniza.sk" required autoComplete="username" /></div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password">{t("login_password")}</label>
            <div className="login-input-wrap"><AppIcon name="lock" size={19} /><input type="password" id="password" name="password" className="input-field" placeholder="••••••••" required autoComplete="current-password" /></div>
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

            <div className="login-security"><AppIcon name="shield" size={18} /><span>{copy.secure}</span></div>
          </div>

          <div className="login-meta">
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
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div className="login-shell" />}><LoginContent /></Suspense>;
}
