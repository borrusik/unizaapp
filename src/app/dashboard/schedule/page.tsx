"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { getScheduleData, type ScheduleItem } from "@/lib/scraper";
import { useTranslation, type TranslationKey } from "@/hooks/useTranslation";
import { getBratislavaDayIndex, getScheduleTiming } from "@/lib/schedule-timing";
import { AppIcon } from "@/components/AppIcon";
import { downloadIcs } from "@/lib/calendar";
import { getBratislavaDateKey, listDateKeys } from "@/lib/uniza-parsers";
import useSWR from "swr";

const REGULAR_DAYS = ["Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok"];

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : -1;
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getTodayDayName(t: (key: TranslationKey) => unknown): string {
  const jsDay = getBratislavaDayIndex();
  if (jsDay === 0 || jsDay === 6) return t("schedule_weekend_tab") as string;
  return REGULAR_DAYS[jsDay - 1];
}

const ScheduleCard = memo(({
  item,
  now,
  isCurrentDay,
  typeLabel,
  t
}: {
  item: ScheduleItem;
  now: Date;
  isCurrentDay: boolean;
  typeLabel: (t: string) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (k: any) => any;
}) => {
  const timing = getScheduleTiming(item.timeStart, item.timeEnd, now, isCurrentDay);

  return (
    <div
      className="schedule-card animate-scale-in"
      style={{
        opacity: 1,
        border: timing.isLive ? "1px solid var(--primary)" : "1px solid var(--border)",
        boxShadow: timing.isLive ? "0 0 0 2px var(--primary-light), var(--shadow-md)" : "var(--shadow-card)",
      }}
    >
      <div className="schedule-time-block">
        <div className="schedule-time-start" style={{ color: timing.isLive ? "var(--primary)" : "inherit", fontWeight: 800 }}>
          {item.timeStart}
        </div>
        <div className="schedule-time-end">{item.timeEnd}</div>

        {item.timeInfo && (
          <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-tertiary)", lineHeight: 1.3, textAlign: "center", wordBreak: "break-word" }}>
            {item.timeInfo}
          </div>
        )}
      </div>

      <div className="schedule-divider" style={{ background: timing.isLive ? "var(--primary)" : item.color }} />

      <div className="schedule-info">
        <div className="schedule-subject-name" style={{ fontSize: "16px", fontWeight: 700 }}>
          {item.subject}
        </div>

        {item.room && (
          <div className="schedule-meta" style={{ marginTop: "4px" }}>
            <AppIcon name="map-pin" size={13} />
            <strong>{item.room}</strong>
            {item.teacher && (
              <>
                <span style={{ margin: "0 2px" }}>·</span>
                <AppIcon name="user" size={13} />
                <span>{item.teacher}</span>
              </>
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
          <span
            className="schedule-type-badge"
            style={{ background: item.color + "22", color: item.color, fontWeight: 700 }}
          >
            {typeLabel(item.type)}
          </span>

          {timing.isLive && (
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "4px" }}>
              <span className="pulse-dot" />
              {t("schedule_min_left")} {timing.minsLeft} min
            </span>
          )}
        </div>

        {timing.isLive && (
          <div className="bento-progress-track" style={{ marginTop: "8px" }}>
            <div className="bento-progress-fill" style={{ width: `${timing.progress}%` }} />
          </div>
        )}
      </div>
    </div>
  );
});
ScheduleCard.displayName = "ScheduleCard";

export default function SchedulePage() {
  const { t } = useTranslation();
  const [selectedDay, setSelectedDay] = useState(() => getTodayDayName(t));
  const [now, setNow] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetcher = async (force = false) => getScheduleData(force);

  const { data, isLoading, mutate } = useSWR("uniza_schedule", () => fetcher(false), {
    dedupingInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
  });

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await mutate(() => fetcher(true), { revalidate: false });
    } finally {
      setIsRefreshing(false);
    }
  };

  const loading = (isLoading || isRefreshing) && (!data || data.items.length === 0);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const dayItems = useMemo(
    () => (data?.items || [])
      .filter((item) => item.day === selectedDay)
      .toSorted((a, b) => toMinutes(a.timeStart) - toMinutes(b.timeStart)),
    [data, selectedDay],
  );
  const scheduleUnavailable = data?.status === "unavailable";
  const scheduleFailed = data?.status === "error" || data?.status === "unauthenticated";

  const exportDay = () => {
    const start = getBratislavaDateKey(now);
    const dates = listDateKeys(start, 7);
    const selectedIndex = REGULAR_DAYS.indexOf(selectedDay) + 1;
    const date = dates.find((key) => new Date(`${key}T12:00:00Z`).getUTCDay() === selectedIndex);
    if (!date || dayItems.length === 0) return;
    downloadIcs(dayItems.map((item) => ({
      uid: `schedule-${item.id}-${selectedDay}`,
      title: item.subject,
      date,
      timeStart: item.timeStart,
      timeEnd: item.timeEnd,
      location: item.room,
      description: [typeLabel(item.type), item.teacher].filter(Boolean).join(" · "),
    })), `uniza-${date}.ics`);
  };

  const typeLabel = (type: string): string => {
    switch (type) {
      case "lecture": return t("schedule_lecture");
      case "exercise": return t("schedule_exercise");
      case "lab": return t("schedule_lab");
      default: return type;
    }
  };

  const isToday = (dayNameCurrent: string) => {
    const jsDay = getBratislavaDayIndex(now);
    if (jsDay === 0 || jsDay === 6) return dayNameCurrent === (t("schedule_weekend_tab") as string);
    return dayNameCurrent === REGULAR_DAYS[jsDay - 1];
  };

  const currentDayIndex = getBratislavaDayIndex(now);
  const isWeekend = currentDayIndex === 0 || currentDayIndex === 6;
  const dayNames = isWeekend ? [...REGULAR_DAYS, t("schedule_weekend_tab") as string] : REGULAR_DAYS;

  return (
    <div>
      <div className="top-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="top-bar-title">{t("schedule_title")}</div>
        <div className="top-bar-actions">
          <button
            type="button"
            aria-label={t("exams_export")}
            onClick={exportDay}
            disabled={dayItems.length === 0}
            className="icon-button"
          >
            <AppIcon name="download" size={20} />
          </button>
          <button
            type="button"
            aria-label={t("common_refresh")}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="icon-button"
          >
            <AppIcon name="refresh" size={20} className={isRefreshing ? "spin" : ""} />
          </button>
        </div>
      </div>

      <div className="container">
        {/* Day Pills */}
        {!scheduleUnavailable && !scheduleFailed ? (
          <div className="day-pills">
            {dayNames.map((dayNameOriginal, i) => {
              const shortDays = (t("schedule_days_short") as unknown as string[]) || ["Po", "Ut", "St", "Št", "Pi"];
              const allShortDays = isWeekend ? [...shortDays, "Vík"] : shortDays;
              const todayMarker = isToday(dayNameOriginal);
              const isActive = selectedDay === dayNameOriginal;

              return (
                <button
                  type="button"
                  aria-pressed={isActive}
                  key={dayNameOriginal}
                  className={`day-pill ${isActive ? "active" : ""}`}
                  onClick={() => setSelectedDay(dayNameOriginal)}
                  style={{
                    position: "relative",
                    flex: "1 0 auto",
                    minWidth: dayNames.length > 5 ? "calc(100% / 6 - 8px)" : "auto",
                    ...(todayMarker && !isActive
                      ? { borderColor: "var(--primary)", color: "var(--primary)" }
                      : {}),
                  }}
                >
                  <span>{allShortDays[i]}</span>
                  {todayMarker && !isActive && (
                    <span style={{
                      position: "absolute",
                      bottom: "4px",
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      background: "var(--primary)",
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        ) : null}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card skeleton" style={{ height: "100px" }} />
            ))}
          </div>
        ) : scheduleUnavailable || scheduleFailed ? (
          <div className="empty-state schedule-source-state">
            <AppIcon name="warning" size={42} />
            <div className="card-title">
              {t(scheduleUnavailable ? "schedule_unavailable_title" : "schedule_error_title")}
            </div>
            <p className="text-sm">
              {t(scheduleUnavailable ? "schedule_unavailable_desc" : "schedule_error_desc")}
            </p>
          </div>
        ) : dayItems.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: "80px" }}>
            <AppIcon name="empty-calendar" size={48} />
            <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
              {selectedDay === t("schedule_weekend_tab") ? t("schedule_weekend_title") : t("schedule_no_classes_title")}
            </div>
            <div style={{ fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {selectedDay === t("schedule_weekend_tab")
                ? t("schedule_weekend_desc")
                : t("schedule_no_classes_desc")}
            </div>
          </div>
        ) : (
          <div className="stagger animate-slide-up" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {dayItems.map((item, idx) => {
              const prevItem = idx > 0 ? dayItems[idx - 1] : null;
              const breakMins = prevItem ? toMinutes(item.timeStart) - toMinutes(prevItem.timeEnd) : 0;

              return (
                <div key={item.id}>
                  {breakMins >= 15 && (
                    <div className="timeline-break">
                      <span>☕ Prestávka {formatDuration(breakMins)}</span>
                    </div>
                  )}
                  <ScheduleCard
                    item={item}
                    now={now}
                    isCurrentDay={isToday(selectedDay)}
                    typeLabel={typeLabel}
                    t={t}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
