"use client";

import Link from "next/link";
import useSWR from "swr";
import { getHomeAcademic, getHomeExams, getHomeFood, getHomePrimary } from "@/lib/home";
import { getBratislavaDayIndex, getScheduleTiming } from "@/lib/schedule-timing";
import { useTranslation } from "@/hooks/useTranslation";
import { AppIcon, type AppIconName } from "@/components/AppIcon";
import { getBratislavaDateKey } from "@/lib/uniza-parsers";

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
  const swrOptions = { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false };
  const { data: primary, isLoading } = useSWR("uniza_home_primary", getHomePrimary, swrOptions);
  const { data: academic } = useSWR(primary ? "uniza_home_academic" : null, getHomeAcademic, swrOptions);
  const { data: food } = useSWR(primary ? "uniza_home_food" : null, getHomeFood, swrOptions);
  const selectedYear = academic?.subjects?.selectedStartYear ?? academic?.grades?.selectedStartYear;
  const { data: exams } = useSWR(selectedYear ? ["uniza_home_exams", selectedYear] : null, () => getHomeExams(selectedYear!), swrOptions);
  const now = new Date();
  const dayName = SCHEDULE_DAYS[getBratislavaDayIndex(now)] || "";
  const nowMinutes = currentBratislavaMinutes(now);
  const todayClasses = (primary?.schedule || [])
    .filter((item) => item.day === dayName)
    .toSorted((a, b) => toMinutes(a.timeStart) - toMinutes(b.timeStart));
  const nextClass = todayClasses.find((item) => toMinutes(item.timeEnd) >= nowMinutes) || null;
  const nextClassTiming = nextClass
    ? getScheduleTiming(nextClass.timeStart, nextClass.timeEnd, now, true)
    : null;

  const firstName = primary?.user?.name?.split(" ")[0] || "";
  const subjectCount = academic?.subjects
    ? academic.subjects.winter.length + academic.subjects.summer.length
    : null;
  const currentGrades = academic?.grades
    ? [...academic.grades.winter, ...academic.grades.summer].filter(
      (grade) => grade.academicYearStart === academic.grades?.selectedStartYear,
    )
    : [];
  const passedGrades = currentGrades.filter(
    (grade) => grade.grade && grade.grade !== "—" && grade.grade !== "FX",
  ).length;
  const balance = food ? `${food.balance.toFixed(2).replace(".", ",")} €` : "—";
  const todayKey = getBratislavaDateKey(now);
  const nextExam = exams?.find((term) => term.date >= todayKey) || null;

  const rows: Array<{
    href: string;
    icon: AppIconName;
    title: string;
    detail: string;
  }> = [
    {
      href: "/dashboard/schedule",
      icon: "calendar",
      title: t("home_schedule_today") as string,
      detail: isLoading ? "—" : `${todayClasses.length} ${t("home_classes")}`,
    },
    {
      href: "/dashboard/subjects",
      icon: "book",
      title: t("nav_subjects") as string,
      detail: subjectCount === null ? "—" : `${subjectCount} ${t("home_subjects_year")}`,
    },
    {
      href: "/dashboard/grades",
      icon: "award",
      title: t("nav_grades") as string,
      detail: !academic ? "—" : `${passedGrades}/${currentGrades.length} ${t("home_grades_passed")}`,
    },
    {
      href: "/dashboard/exams",
      icon: "calendar",
      title: t("home_exams") as string,
      detail: nextExam ? `${nextExam.date.split("-").reverse().join(".")} · ${nextExam.subject}` : t("exams_empty") as string,
    },
    {
      href: "/dashboard/services",
      icon: "building",
      title: t("home_services") as string,
      detail: "AIVS, Moodle, mapa, email",
    },
  ];

  return (
    <div>
      <div className="top-bar">
        <div className="top-bar-title">{t("home_title")}</div>
      </div>

      <div className="container home-page animate-slide-up">
        <p className="home-greeting">
          {t("home_greeting")}{firstName ? `, ${firstName}` : ""}
        </p>
        <div className="home-today-label">{t("home_today")}</div>

        <Link href="/dashboard/schedule" className="home-next-class">
          {isLoading ? (
            <div className="home-next-skeleton skeleton" />
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
              <AppIcon name="calendar" size={31} className="home-next-icon" />
            </>
          ) : (
            <>
              <div className="home-next-copy home-next-empty">
                <h2>{t("home_no_more_classes")}</h2>
              </div>
              <AppIcon name="empty-calendar" size={31} className="home-next-icon" />
            </>
          )}
        </Link>

        <div className="home-links">
          {rows.map((row) => (
            <Link key={row.href} href={row.href} className="home-link-row">
              <AppIcon name={row.icon} size={24} />
              <span className="home-link-copy">
                <strong>{row.title}</strong>
                <small>{row.detail}</small>
              </span>
              <AppIcon name="chevron-right" size={19} />
            </Link>
          ))}
        </div>

        <Link href="/dashboard/food" className="home-food-row">
          <AppIcon name="restaurant" size={25} />
          <span className="home-link-copy">
            <strong>{t("nav_food")}</strong>
            <small>{balance}</small>
          </span>
          <span className="home-food-action">{t("home_open_menu")}</span>
          <AppIcon name="chevron-right" size={18} />
        </Link>
      </div>
    </div>
  );
}
