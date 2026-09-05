"use client";

import { useState, useEffect } from "react";
import { getGrades } from "@/lib/scraper";
import type { Grade } from "@/lib/scraper";
import { useTranslation } from "@/hooks/useTranslation";
import { AcademicPeriodControls } from "@/components/AcademicPeriodControls";
import { AppIcon } from "@/components/AppIcon";
import useSWR from "swr";

export default function GradesPage() {
  const [semester, setSemester] = useState<"winter" | "summer">("winter");
  const [academicYearStart, setAcademicYearStart] = useState<number | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const stored = Number(window.localStorage.getItem("uniza:academic-year:v1"));
    return Number.isInteger(stored) && stored > 2000 ? stored : undefined;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { t } = useTranslation();

  const fetcher = async () => getGrades(academicYearStart);

  const { data, isLoading, mutate } = useSWR(
    ["uniza_grades", academicYearStart ?? "current"],
    fetcher,
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false },
  );

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await mutate(() => getGrades(academicYearStart, true), { revalidate: false });
    } finally {
      setIsRefreshing(false);
    }
  };

  const loading = (isLoading || isRefreshing) && (!data || (data.winter.length === 0 && data.summer.length === 0));

  const grades = data || {
    winter: [],
    summer: [],
    academicYear: "",
    academicYears: [],
    selectedStartYear: academicYearStart || 0,
  };

  const allForSemester = grades[semester];
  const current = allForSemester.filter(
    (grade) => grade.academicYearStart === grades.selectedStartYear,
  );
  const completed = current.filter((grade) => grade.grade && grade.grade !== "—");
  const pending = current.filter((grade) => !grade.grade || grade.grade === "—");

  const gradeClassMap: Record<string, string> = {
    A: "badge-a", B: "badge-b", C: "badge-c", D: "badge-d", E: "badge-e", FX: "badge-fx",
  };

  const gradeColorMap: Record<string, string> = {
    A: "var(--success)", B: "#5ac8fa", C: "var(--warning)", D: "var(--purple)", E: "var(--orange)", FX: "var(--danger)",
  };

  const earnedCredits = current
    .filter((g) => g.grade && g.grade !== "—" && g.grade !== "FX" && g.grade !== "")
    .reduce((sum, g) => sum + g.credits, 0);

  const avgGrade = (() => {
    const gradeValues: Record<string, number> = { A: 1, B: 1.5, C: 2, D: 2.5, E: 3, FX: 4 };
    const scored = current.filter((g) => gradeValues[g.grade] !== undefined);
    if (scored.length === 0) return "—";
    const total = scored.reduce((sum, g) => sum + gradeValues[g.grade] * g.credits, 0);
    const totalCredits = scored.reduce((sum, g) => sum + g.credits, 0);
    return (total / totalCredits).toFixed(2);
  })();

  const passedCount = current.filter((g) => g.grade && g.grade !== "—" && g.grade !== "FX" && g.grade !== "").length;

  const renderGradeRows = (items: Grade[]) => (
    <div className="card-group">
      {items.map((item) => {
        const displayGrade = item.grade || "—";
        const cls = gradeClassMap[displayGrade] || "";
        const color = gradeColorMap[displayGrade] || "var(--text-tertiary)";
        return (
          <div key={`${item.code}-${item.date}-${item.type}`} className="card-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="card-title grade-subject-title" style={{ fontSize: "15px", fontWeight: 650 }}>
                {item.subject}
              </div>
              <div className="text-xs grade-meta" style={{ marginTop: "3px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <span>{item.code}</span>
                {item.credits > 0 && <><span>·</span><span>{item.credits} {t("grades_credits_short")}</span></>}
                {item.date && <><span>·</span><span>{item.date}</span></>}
                {item.points && item.points !== "—" && item.points !== "" && <><span>·</span><span>{item.points} {t("grades_points_short")}</span></>}
              </div>
            </div>
            <div
              className={`grade-circle ${cls}`}
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: "15px",
                background: displayGrade === "—" ? "var(--surface-secondary)" : undefined,
                color: displayGrade === "—" ? "var(--text-tertiary)" : color,
              }}
            >
              {displayGrade}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <div className="top-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="top-bar-title">{t("grades_title")}</div>
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

      <div className="container">
        <AcademicPeriodControls
          academicYearLabel={t("common_academic_year")}
          years={grades.academicYears}
          selectedStartYear={grades.selectedStartYear}
          onYearChange={(startYear) => {
            setAcademicYearStart(startYear);
            window.localStorage.setItem("uniza:academic-year:v1", String(startYear));
          }}
          semester={semester}
          onSemesterChange={setSemester}
          winterLabel={t("grades_winter")}
          summerLabel={t("grades_summer")}
          winterCount={grades.winter.filter((grade) => grade.academicYearStart === grades.selectedStartYear).length}
          summerCount={grades.summer.filter((grade) => grade.academicYearStart === grades.selectedStartYear).length}
          disabled={loading || grades.academicYears.length === 0}
        />

        {loading ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "24px" }}>
              <div className="stat-card skeleton" style={{ height: "84px" }} />
              <div className="stat-card skeleton" style={{ height: "84px" }} />
              <div className="stat-card skeleton" style={{ height: "84px" }} />
            </div>
            <div className="card-group content">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="card-row skeleton" style={{ height: "72px" }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-slide-up">
            {current.length === 0 ? (
              <div className="empty-state">
                <AppIcon name="award" size={42} />
                <div className="card-title">{t("grades_no_data")}</div>
                <p className="text-sm">{t("grades_no_data_year")}</p>
              </div>
            ) : (
              <>
                <div className="grades-stats" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "24px" }}>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--primary)", fontSize: "24px" }}>{earnedCredits}</div>
                    <div className="stat-label">ECTS</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--success)", fontSize: "24px" }}>{avgGrade}</div>
                    <div className="stat-label">{t("profile_avg")}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--warning)", fontSize: "24px" }}>{passedCount}/{current.length}</div>
                    <div className="stat-label">{t("profile_completed")}</div>
                  </div>
                </div>
                {completed.length > 0 ? renderGradeRows(completed) : null}
                {pending.length > 0 ? (
                  <section className="pending-grades">
                    <div className="section-label">{t("grades_no_grade")} <span>{pending.length}</span></div>
                    {renderGradeRows(pending)}
                  </section>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
