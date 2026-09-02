"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { getSchedule, type ScheduleItem } from "@/lib/scraper";
import { useTranslation } from "@/hooks/useTranslation";
import { getBratislavaDayIndex, getScheduleTiming } from "@/lib/schedule-timing";
import { AppIcon } from "@/components/AppIcon";

import useSWR from "swr";

// Internal standard days
const REGULAR_DAYS = ["Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok"];

function getTodayDayName(t: (key: keyof typeof import("@/hooks/useTranslation").dictionary.sk) => unknown): string {
  const jsDay = getBratislavaDayIndex(); // 0=Sun, 1=Mon...
  if (jsDay === 0 || jsDay === 6) return t("schedule_weekend_tab") as string; // weekend -> show Víkend
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
        opacity: 0,
        ...(timing.isLive ? {
          borderColor: "var(--primary)",
          boxShadow: "0 0 0 2px var(--primary-light), var(--shadow-card)"
        } : {})
      }}
    >
      <div className="schedule-time-block">
        <div className="schedule-time-start" style={{ color: timing.isLive ? "var(--primary)" : "inherit" }}>
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
        <div className="schedule-subject-name">{item.subject}</div>
        {item.room && (
          <div className="schedule-meta">
            <AppIcon name="map-pin" size={13} />
            {item.room}
            {item.teacher && (
              <>
                <span style={{ margin: "0 2px" }}>·</span>
                <AppIcon name="user" size={13} />
                {item.teacher}
              </>
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
          <span
            className="schedule-type-badge"
            style={{ background: item.color + "26", color: item.color }}
          >
            {typeLabel(item.type)}
          </span>

          {timing.isLive && (
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary)" }} className="animate-fade-in">
              {t("schedule_min_left" as keyof typeof import("@/hooks/useTranslation").dictionary.sk)} {timing.minsLeft} min
            </span>
          )}
        </div>

        {timing.isLive && (
          <div style={{ width: "100%", height: "4px", background: "var(--surface-secondary)", borderRadius: "2px", marginTop: "6px", overflow: "hidden" }}>
            <div style={{ width: `${timing.progress}%`, height: "100%", background: "var(--primary)", transition: "width 1s linear" }} />
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
  const [mounted, setMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetcher = async (force = false) => getSchedule(force);

  const { data, isLoading, mutate } = useSWR("uniza_schedule", () => fetcher(false));

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await mutate(() => fetcher(true), { revalidate: false });
    } finally {
      setIsRefreshing(false);
    }
  };

  const loading = !mounted || ((isLoading || isRefreshing) && (!data || data.length === 0));

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    // Update time every minute for the live class progress
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => {
      clearTimeout(t);
      clearInterval(timer);
    };
  }, []);

  const dayItems = useMemo(() => (data || []).filter((item) => item.day === selectedDay), [data, selectedDay]);

  const typeLabel = (type: string): string => {
    type DictKey = keyof typeof import("@/hooks/useTranslation").dictionary.sk;
    switch (type) {
      case "lecture": return t("schedule_lecture" as DictKey) as string;
      case "exercise": return t("schedule_exercise" as DictKey) as string;
      case "lab": return t("schedule_lab" as DictKey) as string;
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
        <button
          type="button"
          aria-label={t("common_refresh") as string}
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="icon-button"
        >
          <AppIcon name="refresh" size={20} className={isRefreshing ? "spin" : ""} />
        </button>
      </div>

      <div className="container">
        {/* Day Pills with dates */}
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

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card skeleton" style={{ height: "100px" }} />
            ))}
          </div>
        ) : dayItems.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: "80px" }}>
            <AppIcon name="empty-calendar" size={48} />
            <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
              {selectedDay === t("schedule_weekend_tab") ? t("schedule_weekend_title") as string : t("schedule_no_classes_title") as string}
            </div>
            <div style={{ fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {selectedDay === t("schedule_weekend_tab")
                ? t("schedule_weekend_desc") as string
                : t("schedule_no_classes_desc") as string}
            </div>
          </div>
        ) : (
          <div className="stagger animate-slide-up" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {dayItems.map((item) => (
              <ScheduleCard
                key={item.id}
                item={item}
                now={now}
                isCurrentDay={isToday(selectedDay)}
                typeLabel={typeLabel}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
