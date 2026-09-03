"use client";

import { useEffect, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { useTranslation } from "@/hooks/useTranslation";
import { getBratislavaDateKey, listDateKeys, localDateToUtcIso } from "@/lib/uniza-parsers";

const STORAGE_KEY = "uniza:notifications:v1";
const DAYS = ["", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"];

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
    if (!("Notification" in window)) { setPermission("unsupported"); return; }
    setPermission(Notification.permission);
    setEnabled(window.localStorage.getItem(STORAGE_KEY) === "on" && Notification.permission === "granted");
  }, []);

  useEffect(() => {
    if (!enabled || permission !== "granted") return;
    const timers: number[] = [];
    const schedule = async () => {
      const { getSchedule, getExamTerms } = await import("@/lib/scraper");
      const [classes, exams] = await Promise.all([getSchedule(), getExamTerms()]);
      const now = Date.now();
      const dateKeys = listDateKeys(getBratislavaDateKey(new Date()), 7);
      const upcoming = [
        ...classes.flatMap((item) => dateKeys.filter((date) => DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()] === item.day).map((date) => ({ title: item.subject, body: `${item.timeStart} · ${item.room}`, at: eventTime(date, item.timeStart) }))),
        ...exams.terms.filter((term) => term.canCancel).map((term) => ({ title: term.subject, body: `${term.time} · ${term.room}`, at: eventTime(term.date, term.time) })),
      ];
      for (const event of upcoming) {
        const delay = (event.at?.getTime() || 0) - now - 10 * 60_000;
        if (delay <= 0 || delay > 7 * 24 * 60 * 60_000) continue;
        timers.push(window.setTimeout(() => new Notification(event.title, { body: event.body, icon: "/icon-192.png" }), delay));
      }
    };
    schedule().catch(() => undefined);
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [enabled, permission]);

  const toggle = async () => {
    if (!("Notification" in window)) return;
    if (enabled) {
      setEnabled(false);
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    if (nextPermission === "granted") {
      setEnabled(true);
      window.localStorage.setItem(STORAGE_KEY, "on");
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
