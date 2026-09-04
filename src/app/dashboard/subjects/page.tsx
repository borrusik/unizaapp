"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { getSubjects } from "@/lib/scraper";
import { useTranslation } from "@/hooks/useTranslation";
import { AcademicPeriodControls } from "@/components/AcademicPeriodControls";
import { AppIcon } from "@/components/AppIcon";

export default function SubjectsPage() {
  const [semester, setSemester] = useState<"winter" | "summer">("winter");
  const [academicYearStart, setAcademicYearStart] = useState<number>();
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const stored = Number(window.localStorage.getItem("uniza:academic-year:v1"));
    if (Number.isInteger(stored) && stored > 2000) setAcademicYearStart(stored);
    setPreferencesReady(true);
  }, []);

  const { data, isLoading, mutate } = useSWR(
    preferencesReady ? ["uniza_subjects", academicYearStart ?? "current"] : null,
    () => getSubjects(academicYearStart),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false },
  );

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await mutate(() => getSubjects(academicYearStart, true), { revalidate: false });
    } finally {
      setIsRefreshing(false);
    }
  };

  const loading = !preferencesReady || (isLoading && !data);
  const subjects = data || {
    winter: [],
    summer: [],
    academicYear: "",
    academicYears: [],
    selectedStartYear: academicYearStart || 0,
  };
  const current = subjects[semester];

  return (
    <div>
      <div className="top-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="top-bar-title">{t("subjects_title")}</div>
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
        <AcademicPeriodControls
          academicYearLabel={t("common_academic_year") as string}
          years={subjects.academicYears}
          selectedStartYear={subjects.selectedStartYear}
          onYearChange={(startYear) => {
            setAcademicYearStart(startYear);
            window.localStorage.setItem("uniza:academic-year:v1", String(startYear));
          }}
          semester={semester}
          onSemesterChange={setSemester}
          winterLabel={t("subjects_winter") as string}
          summerLabel={t("subjects_summer") as string}
          winterCount={subjects.winter.length}
          summerCount={subjects.summer.length}
          disabled={loading || subjects.academicYears.length === 0}
        />

        {loading ? (
          <div className="subject-list skeleton-list">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="subject-row skeleton" />)}
          </div>
        ) : current.length === 0 ? (
          <div className="empty-state">
            <AppIcon name="book" size={42} />
            <div className="card-title">{t("subjects_no_data")}</div>
            <p className="text-sm">{t("subjects_no_data_year")}</p>
          </div>
        ) : (
          <div className="subject-list animate-slide-up">
            {current.map((subject) => (
              <div key={subject.id} className="subject-row">
                <div className="subject-row-copy">
                  <h3>{subject.name}</h3>
                  <div className="subject-code">{subject.code}</div>
                </div>
                <div className="subject-actions">
                  {subject.hasMoodle ? (
                    <a
                      href={subject.moodleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="subject-action"
                      aria-label={`${t("dashboard_moodle")}: ${subject.name}`}
                      title={t("dashboard_moodle") as string}
                    >
                      <AppIcon name="external-link" size={19} />
                    </a>
                  ) : null}
                  {subject.infoUrl ? (
                    <Link
                      href={`/dashboard/subject?url=${encodeURIComponent(subject.infoUrl)}&name=${encodeURIComponent(subject.name)}`}
                      className="subject-action"
                      aria-label={`${t("dashboard_info_list")}: ${subject.name}`}
                      title={t("dashboard_info_list") as string}
                    >
                      <AppIcon name="clipboard" size={19} />
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
