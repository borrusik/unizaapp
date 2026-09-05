"use client";

import Link from "next/link";
import useSWR from "swr";
import { getHomePrimary } from "@/lib/home";
import { getBratislavaDayIndex, getScheduleTiming } from "@/lib/schedule-timing";
import { useTranslation, type Lang } from "@/hooks/useTranslation";
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

const LOCALES: Record<Lang, string> = { sk: "sk-SK", en: "en-GB", uk: "uk-UA", ru: "ru-RU" };

export default function HomePage() {
  const { t, lang } = useTranslation();
  const { data: primary, isLoading } = useSWR("uniza_home_primary", getHomePrimary, {
    dedupingInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
  });

  // Secondary data fetched gracefully in background
  const { data: stravaInfo } = useSWR("uniza_home_strava", async () => {
    const { getStravaInfo } = await import("@/lib/strava");
    return getStravaInfo(false);
  }, { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false });

  const { data: gradesData } = useSWR("uniza_home_grades", async () => {
    const { getGrades } = await import("@/lib/scraper");
    return getGrades();
  }, { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false });

  const now = new Date();
  const dayName = SCHEDULE_DAYS[getBratislavaDayIndex(now)] || "";
  const nowMinutes = currentBratislavaMinutes(now);
  const scheduleItems = primary?.schedule.items ?? [];
  const todayClasses = scheduleItems
    .filter((item) => item.day === dayName)
    .toSorted((left, right) => toMinutes(left.timeStart) - toMinutes(right.timeStart));

  // Find active class or next class
  const activeClass = todayClasses.find(
    (item) => toMinutes(item.timeStart) <= nowMinutes && nowMinutes < toMinutes(item.timeEnd),
  );
  const nextClass = activeClass || todayClasses.find((item) => toMinutes(item.timeEnd) >= nowMinutes) || null;
  const timing = nextClass
    ? getScheduleTiming(nextClass.timeStart, nextClass.timeEnd, now, true)
    : null;

  const scheduleUnavailable = primary?.schedule.status === "unavailable";
  const scheduleFailed = primary?.schedule.status === "error" || primary?.schedule.status === "unauthenticated";
  const firstName = primary?.user?.name?.split(" ")[0] || "";

  // Academic calculations
  const allGrades = gradesData ? [...gradesData.winter, ...gradesData.summer] : [];
  const totalCredits = allGrades
    .filter((g) => g.grade && g.grade !== "—" && g.grade !== "FX" && g.grade !== "")
    .reduce((sum, g) => sum + g.credits, 0);

  const gradeValues: Record<string, number> = { A: 1, B: 1.5, C: 2, D: 2.5, E: 3, FX: 4 };
  const scored = allGrades.filter((g) => gradeValues[g.grade] !== undefined);
  const scoredCredits = scored.reduce((sum, g) => sum + g.credits, 0);
  const avgGrade = scored.length > 0 && scoredCredits > 0
    ? (scored.reduce((sum, g) => sum + gradeValues[g.grade] * g.credits, 0) / scoredCredits).toFixed(2)
    : "—";

  const dateFormatted = new Intl.DateTimeFormat(LOCALES[lang] || "sk-SK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  const shortcuts: Array<{ href: string; icon: AppIconName; title: string }> = [
    { href: "/dashboard/schedule", icon: "calendar", title: t("nav_schedule") },
    { href: "/dashboard/subjects", icon: "book", title: t("nav_subjects") },
    { href: "/dashboard/grades", icon: "award", title: t("nav_grades") },
    { href: "/dashboard/food", icon: "restaurant", title: t("nav_food") },
  ];

  return (
    <div>
      <div className="top-bar home-top-bar">
        <div className="top-bar-title">UNIZA Student</div>
      </div>

      <div className="container home-page animate-slide-up">
        {/* Header / Greeting */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
          <div>
            <p className="home-greeting" style={{ margin: 0 }}>
              {t("home_greeting")}{firstName ? `, ${firstName}` : ""} 👋
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", textTransform: "capitalize", marginTop: "4px" }}>
              {dateFormatted}
            </p>
          </div>
          {primary?.user?.academicYear && (
            <span className="badge badge-neutral" style={{ alignSelf: "center" }}>
              {primary.user.academicYear}
            </span>
          )}
        </div>

        {/* Hero Live Class Card */}
        <Link href="/dashboard/schedule" className="bento-card bento-hero" style={{ textDecoration: "none" }}>
          {isLoading ? (
            <div className="home-next-skeleton skeleton" style={{ minHeight: "120px" }} />
          ) : scheduleUnavailable || scheduleFailed ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <div>
                <span className="live-badge" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
                  {t("nav_schedule")}
                </span>
                <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "6px 0 4px", color: "var(--text-primary)" }}>
                  {t(scheduleUnavailable ? "schedule_unavailable_title" : "schedule_error_title")}
                </h2>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
                  {t(scheduleUnavailable ? "schedule_unavailable_desc" : "schedule_error_desc")}
                </p>
              </div>
              <AppIcon name="warning" size={32} style={{ color: "var(--danger)", flexShrink: 0 }} />
            </div>
          ) : nextClass ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                <div>
                  <span className="live-badge">
                    {timing?.isLive ? (
                      <>
                        <span className="pulse-dot" />
                        {t("schedule_today")} (Live)
                      </>
                    ) : (
                      t("home_next_class")
                    )}
                  </span>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
                    {nextClass.timeStart} – {nextClass.timeEnd}
                  </div>
                </div>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--surface-secondary)", display: "grid", placeItems: "center", color: "var(--text-secondary)" }}>
                  <AppIcon name="chevron-right" size={20} />
                </div>
              </div>

              <div style={{ marginTop: "12px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>
                  {nextClass.subject}
                </h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "13px", color: "var(--text-secondary)" }}>
                  {nextClass.room && (
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <AppIcon name="map-pin" size={14} />
                      {nextClass.room}
                    </span>
                  )}
                  {nextClass.teacher && (
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <AppIcon name="user" size={14} />
                      {nextClass.teacher}
                    </span>
                  )}
                </div>
              </div>

              {timing?.isLive && (
                <div style={{ marginTop: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, color: "var(--primary)", marginBottom: "6px" }}>
                    <span>{t("schedule_min_left")}</span>
                    <span>{timing.minsLeft} min</span>
                  </div>
                  <div className="bento-progress-track">
                    <div className="bento-progress-fill" style={{ width: `${timing.progress}%` }} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "10px 0" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
                  {t("home_no_more_classes")}
                </h2>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
                  {t("schedule_no_classes_desc")}
                </p>
              </div>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "var(--surface-secondary)", display: "grid", placeItems: "center", color: "var(--primary)" }}>
                <AppIcon name="empty-calendar" size={24} />
              </div>
            </div>
          )}
        </Link>

        {/* Bento Grid: ISIC Balance + Study Progress */}
        <div className="bento-grid">
          {/* ISIC & Strava Card */}
          <Link href="/dashboard/food" className="bento-card">
            <div>
              <div className="bento-card-header">
                <span className="bento-card-title">
                  <AppIcon name="restaurant" size={16} />
                  {t("food_title")}
                </span>
                <span className="badge badge-credits">WebKredit</span>
              </div>
              <div className="bento-stat-val">
                {stravaInfo ? `${stravaInfo.balance.toFixed(2)} €` : "— €"}
              </div>
              <div className="bento-stat-sub">
                {t("food_balance")} (ISIC)
              </div>
            </div>

            <div style={{ marginTop: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "12px", borderTop: "1px solid var(--border)", fontSize: "12px", fontWeight: 650, color: "var(--primary)" }}>
              <span>{t("home_open_menu")}</span>
              <AppIcon name="chevron-right" size={16} />
            </div>
          </Link>

          {/* ECTS & GPA Card */}
          <Link href="/dashboard/grades" className="bento-card">
            <div>
              <div className="bento-card-header">
                <span className="bento-card-title">
                  <AppIcon name="award" size={16} />
                  {t("nav_study")}
                </span>
                <span className="badge badge-credits">
                  {avgGrade !== "—" ? `GPA ${avgGrade}` : t("grades_title")}
                </span>
              </div>
              <div className="bento-stat-val">
                {totalCredits} <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-secondary)" }}>ECTS</span>
              </div>
              <div className="bento-stat-sub">
                {t("subjects_completed")} ({totalCredits} / 60 ECTS)
              </div>
              <div className="bento-progress-track">
                <div
                  className="bento-progress-fill"
                  style={{ width: `${Math.min(100, Math.round((totalCredits / 60) * 100))}%` }}
                />
              </div>
            </div>

            <div style={{ marginTop: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "12px", borderTop: "1px solid var(--border)", fontSize: "12px", fontWeight: 650, color: "var(--primary)" }}>
              <span>{t("grades_title")}</span>
              <AppIcon name="chevron-right" size={16} />
            </div>
          </Link>
        </div>

        {/* Today's Classes List (if there are classes) */}
        {todayClasses.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span className="section-title" style={{ fontSize: "16px" }}>
                {t("home_schedule_today")} ({todayClasses.length})
              </span>
              <Link href="/dashboard/schedule" style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary)" }}>
                {t("schedule_title")} →
              </Link>
            </div>

            <div className="bento-today-list">
              {todayClasses.map((item) => {
                const itemEndMins = toMinutes(item.timeEnd);
                const isPast = itemEndMins < nowMinutes;
                const isCurrent = toMinutes(item.timeStart) <= nowMinutes && nowMinutes <= itemEndMins;

                return (
                  <div
                    key={`${item.timeStart}-${item.subject}`}
                    className="bento-today-item"
                    style={{
                      opacity: isPast ? 0.6 : 1,
                      borderLeft: isCurrent ? "3px solid var(--primary)" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                      <strong style={{ fontSize: "13px", color: isCurrent ? "var(--primary)" : "var(--text-primary)", fontVariantNumeric: "tabular-nums", width: "95px" }}>
                        {item.timeStart}–{item.timeEnd}
                      </strong>
                      <span style={{ fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.subject}
                      </span>
                    </div>
                    {item.room && (
                      <span className="badge badge-neutral" style={{ fontSize: "11px", padding: "2px 8px" }}>
                        {item.room}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Shortcuts */}
        <div style={{ marginTop: "24px" }}>
          <div style={{ fontSize: "13px", fontWeight: 750, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
            {t("home_services")}
          </div>

          <nav className="home-shortcuts" aria-label={t("home_services")}>
            {shortcuts.map((shortcut) => (
              <Link key={shortcut.href} href={shortcut.href} className="home-shortcut">
                <span className="home-shortcut-icon">
                  <AppIcon name={shortcut.icon} size={22} />
                </span>
                <strong>{shortcut.title}</strong>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
