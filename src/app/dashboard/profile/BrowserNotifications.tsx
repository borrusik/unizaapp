"use client";

import { useEffect, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { useTranslation } from "@/hooks/useTranslation";
import { getBratislavaDateKey, listDateKeys, localDateToUtcIso } from "@/lib/uniza-parsers";

const STORAGE_KEY = "uniza:notifications:v1";
const SETTINGS_EVENT = "uniza:notifications-change";
const DAYS = ["", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"];
const REFRESH_INTERVAL_MS = 6 * 60 * 60_000;

function eventTime(date: string, time: string) {
  const midnight = localDateToUtcIso(date);
  if (!midnight) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return new Date(new Date(midnight).getTime() + (hours * 60 + minutes) * 60_000);
}

export function BrowserNotifications() {
  const { lang } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!("Notification" in window)) { setPermission("unsupported"); return; }
      setPermission(Notification.permission);
      setEnabled(window.localStorage.getItem(STORAGE_KEY) === "on" && Notification.permission === "granted");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const toggle = async () => {
    if (!("Notification" in window)) return;
    if (enabled) {
      setEnabled(false);
      window.localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event(SETTINGS_EVENT));
      return;
    }
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    if (nextPermission === "granted") {
      setEnabled(true);
      window.localStorage.setItem(STORAGE_KEY, "on");
      window.dispatchEvent(new Event(SETTINGS_EVENT));
    }
  };

  const copy = lang === "sk"
    ? { title: "Pripomienky", detail: "10 minút pred hodinou alebo skúškou, kým je aplikácia otvorená", denied: "Povoľte upozornenia v nastaveniach prehliadača", on: "Zapnuté", off: "Zapnúť" }
    : lang === "en"
      ? { title: "Reminders", detail: "10 minutes before a class or exam while the app is open", denied: "Allow notifications in your browser settings", on: "On", off: "Turn on" }
      : lang === "uk"
        ? { title: "Нагадування", detail: "За 10 хвилин до заняття або іспиту, поки застосунок відкритий", denied: "Дозвольте сповіщення в налаштуваннях браузера", on: "Увімкнено", off: "Увімкнути" }
        : { title: "Напоминания", detail: "За 10 минут до занятия или экзамена, пока приложение открыто", denied: "Разрешите уведомления в настройках браузера", on: "Включены", off: "Включить" };

  if (permission === "unsupported") return null;
  return <button type="button" className="notification-setting" onClick={toggle} disabled={permission === "denied"}><span className="service-icon"><AppIcon name="bell" size={20} /></span><span><strong>{copy.title}</strong><small>{permission === "denied" ? copy.denied : copy.detail}</small></span><span className={`notification-state ${enabled ? "active" : ""}`}>{enabled ? copy.on : copy.off}</span></button>;
}

export function BrowserNotificationScheduler() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(
      "Notification" in window &&
      Notification.permission === "granted" &&
      window.localStorage.getItem(STORAGE_KEY) === "on",
    );
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(SETTINGS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(SETTINGS_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !("Notification" in window) || Notification.permission !== "granted") return;
    let cancelled = false;
    let loading = false;
    let lastRefreshStartedAt = 0;
    let refreshTimer: number | undefined;
    let timers: number[] = [];

    const clearNotificationTimers = () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers = [];
    };

    const queueRefresh = () => {
      if (cancelled) return;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined;
        void schedule();
      }, REFRESH_INTERVAL_MS);
    };

    const schedule = async () => {
      if (cancelled || loading) return;
      if (Date.now() - lastRefreshStartedAt < REFRESH_INTERVAL_MS) return;
      loading = true;
      lastRefreshStartedAt = Date.now();
      try {
        const { getSchedule, getExamTerms } = await import("@/lib/scraper");
        const [classes, exams] = await Promise.all([getSchedule(), getExamTerms()]);
        if (cancelled) return;

        const now = Date.now();
        const dateKeys = listDateKeys(getBratislavaDateKey(new Date()), 7);
        const upcoming = [
          ...classes.flatMap((item) => dateKeys.filter((date) => DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()] === item.day).map((date) => ({ title: item.subject, body: `${item.timeStart} · ${item.room}`, at: eventTime(date, item.timeStart) }))),
          ...exams.terms.filter((term) => term.canCancel).map((term) => ({ title: term.subject, body: `${term.time} · ${term.room}`, at: eventTime(term.date, term.time) })),
        ];
        const nextTimers: number[] = [];
        for (const event of upcoming) {
          const delay = (event.at?.getTime() || 0) - now - 10 * 60_000;
          if (delay <= 0 || delay > 7 * 24 * 60 * 60_000) continue;
          nextTimers.push(window.setTimeout(() => {
            if (
              !cancelled &&
              Notification.permission === "granted" &&
              window.localStorage.getItem(STORAGE_KEY) === "on"
            ) {
              new Notification(event.title, { body: event.body, icon: "/icon-192.png" });
            }
          }, delay));
        }
        if (cancelled) {
          nextTimers.forEach((timer) => window.clearTimeout(timer));
          return;
        }
        clearNotificationTimers();
        timers = nextTimers;
      } catch {
        // Keep the last valid timers when a refresh fails transiently.
      } finally {
        loading = false;
        queueRefresh();
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void schedule();
    };
    const refreshWhenOnline = () => void schedule();

    void schedule();
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("online", refreshWhenOnline);
    return () => {
      cancelled = true;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      clearNotificationTimers();
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenOnline);
    };
  }, [enabled]);

  return null;
}
