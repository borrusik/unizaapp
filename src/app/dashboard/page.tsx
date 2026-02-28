"use client";

import { useState, useEffect } from "react";
import { getSubjects, type Subject } from "@/lib/scraper";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

import useSWR from "swr";

export default function SubjectsPage() {
  const [semester, setSemester] = useState<"winter" | "summer">("summer");
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation();

  const fetcher = async () => {
    const data = await getSubjects();
    try {
      localStorage.setItem("uniza_subjects_cache", JSON.stringify(data));
    } catch { }
    return data;
  };

  const { data, isLoading } = useSWR("uniza_subjects", fetcher, {
    fallbackData: typeof window !== "undefined"
      ? (() => {
        try {
          const cached = localStorage.getItem("uniza_subjects_cache");
          if (cached) return JSON.parse(cached) as { winter: Subject[]; summer: Subject[] };
        } catch { }
        return { winter: [], summer: [] };
      })()
      : { winter: [], summer: [] },
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
  });

  const loading = !mounted || (isLoading && (!data || (data.winter.length === 0 && data.summer.length === 0)));

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);
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
            className={`segment-btn ${semester === "winter" ? "active" : ""}`}
            onClick={() => setSemester("winter")}
          >
            ❄️ {t("subjects_winter")} ({mounted ? subjects.winter.length : 0})
          </button>
          <button
            className={`segment-btn ${semester === "summer" ? "active" : ""}`}
            onClick={() => setSemester("summer")}
          >
            ☀️ {t("subjects_summer")} ({mounted ? subjects.summer.length : 0})
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
          <span className="label">{t("dashboard_acad_year")}</span>
          <span className="badge badge-credits">{mounted ? current.length : 0} {t("dashboard_subjects_count")}</span>
        </div>

        {loading ? (
          <div className="fullscreen-loader">
            <div className="spinner"></div>
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
