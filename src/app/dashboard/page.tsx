"use client";

import { useState } from "react";
import { getSubjects } from "@/lib/scraper";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

import useSWR from "swr";

export default function SubjectsPage() {
  const [semester, setSemester] = useState<"winter" | "summer">("winter");
  const [academicYearStart, setAcademicYearStart] = useState<number>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { t } = useTranslation();

  const fetcher = async () => getSubjects(academicYearStart);

  const { data, isLoading, mutate } = useSWR(
    ["uniza_subjects", academicYearStart ?? "current"],
    fetcher,
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

  const loading = isLoading && !data;
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
          className={isRefreshing ? "spin" : ""}
          style={{
            background: "var(--surface-secondary)",
            border: "none",
            padding: "8px",
            borderRadius: "50%",
            display: "flex",
            cursor: "pointer",
            opacity: isRefreshing ? 0.5 : 1,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </div>

      <div className="container">
        <label style={{ display: "block", marginBottom: "16px" }}>
          <span className="label" style={{ display: "block", marginBottom: "7px" }}>
            {t("common_academic_year")}
          </span>
          <select
            aria-label={t("common_academic_year") as string}
            value={subjects.selectedStartYear || ""}
            onChange={(event) => setAcademicYearStart(Number(event.target.value))}
            disabled={loading || subjects.academicYears.length === 0}
            style={{
              width: "100%",
              minHeight: "44px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-primary)",
              padding: "0 12px",
              fontSize: "15px",
              fontWeight: 600,
            }}
          >
            {subjects.academicYears.map((year) => (
              <option key={year.startYear} value={year.startYear}>{year.label}</option>
            ))}
          </select>
        </label>

        {/* Semester Switcher */}
        <div className="segment-control">
          <button
            type="button"
            aria-pressed={semester === "winter"}
            className={`segment-btn ${semester === "winter" ? "active" : ""}`}
            onClick={() => setSemester("winter")}
          >
            ❄️ {t("subjects_winter")} ({subjects.winter.length})
          </button>
          <button
            type="button"
            aria-pressed={semester === "summer"}
            className={`segment-btn ${semester === "summer" ? "active" : ""}`}
            onClick={() => setSemester("summer")}
          >
            ☀️ {t("subjects_summer")} ({subjects.summer.length})
          </button>
        </div>

        {/* Summary Row */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          padding: "0 4px",
        }}>
          <span className="label">{t("profile_acad_year")} {subjects.academicYear}</span>
          <span className="badge badge-credits">{current.length} {t("dashboard_subjects_count")}</span>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card skeleton" style={{ height: "90px" }} />
            ))}
          </div>
        ) : current.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "36px 20px" }}>
            <div style={{ fontSize: "42px", marginBottom: "10px" }}>📚</div>
            <div className="card-title">{t("subjects_no_data")}</div>
            <p className="text-sm" style={{ marginTop: "6px" }}>{t("subjects_no_data_year")}</p>
          </div>
        ) : (
          <div className="stagger animate-slide-up" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {current.map((subject) => (
              <div key={subject.id} className="card animate-scale-in" style={{ opacity: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                  <div style={{ flex: 1 }}>
                    <div className="text-xs" style={{ marginBottom: "2px", fontWeight: 600, letterSpacing: "0.5px" }}>
                      {subject.code}
                    </div>
                    <h3 className="card-title">{subject.name}</h3>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  {subject.hasMoodle && (
                    <a
                      href={subject.moodleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="badge"
                      style={{ fontSize: "11px", background: "var(--primary-light)", color: "var(--primary)", textDecoration: "none" }}
                    >
                      🎓 {t("dashboard_moodle")}
                    </a>
                  )}
                  {subject.infoUrl && (
                    <Link
                      href={`/dashboard/subject?url=${encodeURIComponent(subject.infoUrl)}&name=${encodeURIComponent(subject.name)}`}
                      className="badge badge-neutral"
                      style={{ fontSize: "11px", textDecoration: "none" }}
                    >
                      📋 {t("dashboard_info_list")}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
