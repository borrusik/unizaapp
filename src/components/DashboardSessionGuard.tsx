"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkDashboardSession } from "@/lib/scraper";
import { AppIcon } from "@/components/AppIcon";

const REAUTH_COOKIE = "uniza_reauth=1";
const LOCAL_CACHE_KEYS = [
  "uniza_subjects_cache",
  "uniza_schedule_cache",
  "uniza_grades_cache",
  "uniza_user_info",
  "uniza_user_cache",
  "uniza_strava_info",
  "uniza_strava_menu",
  "uniza_strava_history",
];

function clearBrowserData() {
  try {
    LOCAL_CACHE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage may be unavailable in private browsing; redirect still works.
  }
}

function loginUrl() {
  const next = window.location.pathname.startsWith("/dashboard")
    ? window.location.pathname
    : "/dashboard";
  return `/?reason=session_expired&next=${encodeURIComponent(next)}`;
}

export function DashboardSessionGuard({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const lastCheck = useRef(0);
  const redirecting = useRef(false);

  const redirectToLogin = useCallback(() => {
    if (redirecting.current) return;
    redirecting.current = true;
    clearBrowserData();
    window.location.replace(loginUrl());
  }, []);

  const verify = useCallback(async () => {
    if (redirecting.current) return;
    if (document.cookie.split("; ").includes(REAUTH_COOKIE)) {
      redirectToLogin();
      return;
    }
    lastCheck.current = Date.now();
    const state = await Promise.race([
      checkDashboardSession().catch(() => "unavailable" as const),
      new Promise<"unavailable">((resolve) => window.setTimeout(() => resolve("unavailable"), 4_000)),
    ]);
    if (state === "unauthenticated") {
      redirectToLogin();
      return;
    }
    setChecking(false);
  }, [redirectToLogin]);

  useEffect(() => {
    const initialFrame = window.requestAnimationFrame(() => void verify());
    const cookieTimer = window.setInterval(() => {
      if (document.cookie.split("; ").includes(REAUTH_COOKIE)) redirectToLogin();
    }, 1_500);
    const healthTimer = window.setInterval(() => void verify(), 5 * 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - lastCheck.current > 60_000) {
        void verify();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.clearInterval(cookieTimer);
      window.clearInterval(healthTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [redirectToLogin, verify]);

  if (checking) {
    return (
      <div className="session-check" role="status" aria-live="polite">
        <div className="brand-mark" aria-hidden="true"><AppIcon name="book" size={25} /></div>
        <div className="session-check-spinner" />
        <p>Pripájame tvoj študentský účet…</p>
      </div>
    );
  }

  return children;
}
