"use client";

import { Suspense, useTransition, useState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/lib/scraper";
import { useTranslation } from "@/hooks/useTranslation";
import { KharkivEasterEgg } from "@/components/KharkivEasterEgg";
import { safeDashboardReturnPath } from "@/lib/auth-state";

function LoginContent() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const { t, lang } = useTranslation();
  const sessionExpired = searchParams.get("reason") === "session_expired";
  const copy = {
    ru: { lead: "Всё для учёбы в одном месте", remember: "Запомнить вход", privacy: "Как сохраняется вход?", help: "Не получается войти?", support: "Написать в поддержку", helpText: "Используй университетскую почту и пароль e-Vzdelávanie. Если вход не работает, проверь доступ к университетскому аккаунту.", independent: "Неофициальный студенческий проект", expired: "Сессия закончилась. Войди снова — вернём тебя на прежнюю страницу.", show: "Показать", hide: "Скрыть", unavailable: "Не удалось подключиться. Попробуй ещё раз." },
    uk: { lead: "Усе для навчання в одному місці", remember: "Запам’ятати вхід", privacy: "Як зберігається вхід?", help: "Не вдається увійти?", support: "Написати в підтримку", helpText: "Використовуй університетську пошту та пароль e-Vzdelávanie. Якщо вхід не працює, перевір доступ до університетського акаунта.", independent: "Неофіційний студентський проєкт", expired: "Сеанс завершився. Увійди знову — повернемо тебе на попередню сторінку.", show: "Показати", hide: "Сховати", unavailable: "Не вдалося підключитися. Спробуй ще раз." },
    sk: { lead: "Všetko pre štúdium na jednom mieste", remember: "Zapamätať prihlásenie", privacy: "Ako sa ukladá prihlásenie?", help: "Nedarí sa prihlásiť?", support: "Napísať podpore", helpText: "Použi univerzitný e-mail a heslo do e-Vzdelávania. Ak prihlásenie nefunguje, over prístup k univerzitnému účtu.", independent: "Neoficiálny študentský projekt", expired: "Prihlásenie vypršalo. Prihlás sa znova a vrátime ťa na predchádzajúcu stránku.", show: "Zobraziť", hide: "Skryť", unavailable: "Pripojenie zlyhalo. Skús to znova." },
    en: { lead: "Everything for your studies, in one place", remember: "Remember sign-in", privacy: "How is sign-in saved?", help: "Trouble signing in?", support: "Contact support", helpText: "Use your university email and e-Vzdelávanie password. If sign-in fails, check access to your university account.", independent: "Unofficial student project", expired: "Your session expired. Sign in again to return to where you stopped.", show: "Show", hide: "Hide", unavailable: "Could not connect. Please try again." },
  }[lang];

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    setError(null);
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
      try {
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
      } catch {
        setError(copy.unavailable);
      }
    });
  };


  return (
    <main className="minimal-login">
      <section className="minimal-login-content" aria-labelledby="login-title">
        <header className="minimal-login-heading">
          <KharkivEasterEgg iconSize={36} />
          <h1 id="login-title">UNIZA Student</h1>
          <p>{copy.lead}</p>
        </header>
        {sessionExpired ? <p role="status" className="login-session-notice">{copy.expired}</p> : null}
        <form onSubmit={handleLogin} method="post" className="minimal-login-form" aria-busy={isPending}>
          <div>
            <label htmlFor="email">{t("login_email")}</label>
            <input type="email" id="email" name="email" placeholder="meno@stud.uniza.sk" required autoComplete="username" autoCapitalize="none" spellCheck={false} />
          </div>
          <div>
            <label htmlFor="password">{t("login_password")}</label>
            <div className="minimal-password">
              <input type={showPassword ? "text" : "password"} id="password" name="password" required autoComplete="current-password" />
              <button type="button" aria-controls="password" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? copy.hide : copy.show}</button>
            </div>
          </div>
          <div className="minimal-remember">
            <label><input type="hidden" name="remember" value="off" /><input type="checkbox" name="remember" value="on" />{copy.remember}</label>
            <details><summary aria-label={copy.privacy} title={copy.privacy}>ⓘ</summary><p>{t("login_safe_msg")}</p></details>
          </div>
          {error ? <p role="alert" className="login-error">{error}</p> : null}
          <button type="submit" className="btn-primary" disabled={isPending}>{isPending ? t("login_loading") : t("login_button")}</button>
        </form>
        <details className="minimal-help">
          <summary>{copy.help}</summary>
          <p>{copy.helpText}</p>
          <a href="https://www.instagram.com/borrusik/" target="_blank" rel="noopener noreferrer">{copy.support}</a>
        </details>
        <footer>{copy.independent}</footer>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<main className="minimal-login" aria-busy="true" />}><LoginContent /></Suspense>;
}
