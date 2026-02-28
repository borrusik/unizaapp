"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { getSchedule, type ScheduleItem } from "@/lib/scraper";
import { useTranslation } from "@/hooks/useTranslation";

import useSWR from "swr";

// Internal standard days
const REGULAR_DAYS = ["Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok"];

function getTodayDayName(t: (key: any) => any): string {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon...
  if (jsDay === 0 || jsDay === 6) return t("schedule_weekend_tab") as string; // weekend -> show Víkend
  return REGULAR_DAYS[jsDay - 1];
}

const ScheduleCard = memo(({
  item,
  now,
  typeLabel,
  typeBg,
  typeColor,
  t
}: {
  item: ScheduleItem;
  now: Date;
  typeLabel: (t: string) => string;
  typeBg: (t: string) => string;
  typeColor: (t: string) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (k: any) => any;
}) => {
  const [sh, sm] = item.timeStart.split(":").map(Number);
  const [eh, em] = item.timeEnd.split(":").map(Number);

  const startObj = new Date(now);
  startObj.setHours(sh, sm, 0, 0);

  const endObj = new Date(now);
  endObj.setHours(eh, em, 0, 0);

  const isLive = now >= startObj && now <= endObj;
  let progress = 0;

  if (isLive) {
    progress = ((now.getTime() - startObj.getTime()) / (endObj.getTime() - startObj.getTime())) * 100;
  }

  const timing = {
    isLive,
    progress: Math.min(Math.max(progress, 0), 100),
    minsLeft: Math.ceil((endObj.getTime() - now.getTime()) / 60000)
  };

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
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {item.room}
            {item.teacher && (
              <>
                <span style={{ margin: "0 2px" }}>·</span>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {item.teacher}
              </>
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
          <span
            className="schedule-type-badge"
            style={{ background: typeBg(item.type), color: typeColor(item.type) }}
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

  const fetcher = async () => {
    const data = await getSchedule();
    try {
      localStorage.setItem("uniza_schedule_cache", JSON.stringify(data));
    } catch { }
    return data;
  };

  const { data, isLoading } = useSWR("uniza_schedule", fetcher, {
    fallbackData: typeof window !== "undefined"
      ? (() => {
        try {
          const cached = localStorage.getItem("uniza_schedule_cache");
          if (cached) return JSON.parse(cached) as ScheduleItem[];
        } catch { }
        return [];
      })()
      : [],
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
  });

  const loading = !mounted || (isLoading && (!data || data.length === 0));

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

  const typeBg = (type: string) => {
    switch (type) {
      case "lecture": return "var(--primary-light)";
      case "exercise": return "var(--warning-light)";
      case "lab": return "var(--success-light)";
      default: return "var(--surface-secondary)";
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case "lecture": return "var(--primary)";
      case "exercise": return "var(--warning)";
      case "lab": return "var(--success)";
      default: return "var(--text-secondary)";
    }
  };

  const isToday = (dayNameCurrent: string) => {
    const today = new Date();
    const jsDay = today.getDay();
    if (jsDay === 0 || jsDay === 6) return dayNameCurrent === (t("schedule_weekend_tab") as string);
    return dayNameCurrent === REGULAR_DAYS[jsDay - 1];
  };

  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
  const dayNames = isWeekend ? [...REGULAR_DAYS, t("schedule_weekend_tab") as string] : REGULAR_DAYS;
  return (
    <div>
      <div className="top-bar">
        <div className="top-bar-title">{t("schedule_title")}</div>
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
          <div style={{
            textAlign: "center",
            padding: "80px 20px",
            color: "var(--text-tertiary)",
          }}>
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>
              {selectedDay === t("schedule_weekend_tab") ? "🍻" : "🎉"}
            </div>
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
                typeLabel={typeLabel}
                typeBg={typeBg}
                typeColor={typeColor}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
