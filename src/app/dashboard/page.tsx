"use client";

import Link from "next/link";
import useSWR from "swr";
import { getHomePrimary } from "@/lib/home";
import { getBratislavaDayIndex, getScheduleTiming } from "@/lib/schedule-timing";
import { useTranslation } from "@/hooks/useTranslation";
import { AppIcon, type AppIconName } from "@/components/AppIcon";

const SCHEDULE_DAYS = ["", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"];
const BRATISLAVA_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Bratislava",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : -1;
}

function currentBratislavaMinutes(now: Date) {
  const parts = Object.fromEntries(
    BRATISLAVA_TIME.formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return parts.hour * 60 + parts.minute;
}

export default function HomePage() {
  const { t } = useTranslation();
  const { data: primary, isLoading } = useSWR("uniza_home_primary", getHomePrimary, {
    dedupingInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
  });

  const now = new Date();
  const dayName = SCHEDULE_DAYS[getBratislavaDayIndex(now)] || "";
  const nowMinutes = currentBratislavaMinutes(now);
  const scheduleItems = primary?.schedule.items ?? [];
  const todayClasses = scheduleItems
    .filter((item) => item.day === dayName)
    .toSorted((left, right) => toMinutes(left.timeStart) - toMinutes(right.timeStart));
  const nextClass = todayClasses.find((item) => toMinutes(item.timeEnd) >= nowMinutes) || null;
  const nextClassTiming = nextClass
    ? getScheduleTiming(nextClass.timeStart, nextClass.timeEnd, now, true)
    : null;
  const scheduleUnavailable = primary?.schedule.status === "unavailable";
  const scheduleFailed = primary?.schedule.status === "error" || primary?.schedule.status === "unauthenticated";
  const firstName = primary?.user?.name?.split(" ")[0] || "";

  const shortcuts: Array<{ href: string; icon: AppIconName; title: string }> = [
    { href: "/dashboard/schedule", icon: "calendar", title: t("nav_schedule") as string },
    { href: "/dashboard/subjects", icon: "book", title: t("nav_subjects") as string },
    { href: "/dashboard/grades", icon: "award", title: t("nav_grades") as string },
    { href: "/dashboard/food", icon: "restaurant", title: t("nav_food") as string },
  ];

  return (
    <div>
      <div className="top-bar home-top-bar">
        <div className="top-bar-title">UNIZA Student</div>
      </div>

      <div className="container home-page animate-slide-up">
        <p className="home-greeting">
          {t("home_greeting")}{firstName ? `, ${firstName}` : ""}
        </p>
        <div className="home-today-label">{t("home_today")}</div>

        <Link href="/dashboard/schedule" className="home-next-class">
          {isLoading ? (
            <div className="home-next-skeleton skeleton" />
          ) : scheduleUnavailable || scheduleFailed ? (
            <>
              <div className="home-next-copy home-next-empty">
                <span>{t("nav_schedule")}</span>
                <h2>{t(scheduleUnavailable ? "schedule_unavailable_title" : "schedule_error_title")}</h2>
                <p>{t(scheduleUnavailable ? "schedule_unavailable_desc" : "schedule_error_desc")}</p>
              </div>
              <AppIcon name="warning" size={28} className="home-next-icon" />
            </>
          ) : nextClass ? (
            <>
              <div className="home-next-copy">
                <span>{nextClassTiming?.isLive ? t("schedule_today") : t("home_next_class")}</span>
                <strong>{nextClass.timeStart}–{nextClass.timeEnd}</strong>
                <h2>{nextClass.subject}</h2>
                {nextClass.room ? (
                  <p><AppIcon name="map-pin" size={17} />{nextClass.room}</p>
                ) : null}
              </div>
              <AppIcon name="chevron-right" size={24} className="home-next-icon" />
            </>
          ) : (
            <>
              <div className="home-next-copy home-next-empty">
                <h2>{t("home_no_more_classes")}</h2>
              </div>
              <AppIcon name="empty-calendar" size={28} className="home-next-icon" />
            </>
          )}
        </Link>

        <nav className="home-shortcuts" aria-label={t("home_services") as string}>
          {shortcuts.map((shortcut) => (
            <Link key={shortcut.href} href={shortcut.href} className="home-shortcut">
              <span className="home-shortcut-icon"><AppIcon name={shortcut.icon} size={25} /></span>
              <strong>{shortcut.title}</strong>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
