"use client";

import { useState } from "react";
import { getSubjects } from "@/lib/scraper";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

import useSWR from "swr";
import { getAcademicYear } from "@/lib/uniza";

export default function SubjectsPage() {
  const [semester, setSemester] = useState<"winter" | "summer">("summer");
  const { t } = useTranslation();

  const fetcher = async () => getSubjects();

  const { data, isLoading } = useSWR("uniza_subjects", fetcher);

  const loading = isLoading && !data;
  const subjects = data || { winter: [], summer: [] };

  const current = subjects[semester];

  return (
    <div>
      <div className="top-bar">
        <div className="top-bar-title">{t("subjects_title")}</div>
      </div>

      <div className="container">
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
          <span className="label">{t("profile_acad_year")} {getAcademicYear()}</span>
          <span className="badge badge-credits">{current.length} {t("dashboard_subjects_count")}</span>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card skeleton" style={{ height: "90px" }} />
            ))}
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
    </div>
  );
}
