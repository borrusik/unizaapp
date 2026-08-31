"use client";

import { useState, useEffect } from "react";
import { getGrades } from "@/lib/scraper";
import { useTranslation } from "@/hooks/useTranslation";

import useSWR from "swr";

export default function GradesPage() {
  const [semester, setSemester] = useState<"winter" | "summer">("winter");
  const [mounted, setMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { t } = useTranslation();

  const fetcher = async () => getGrades();

  const { data, isLoading, mutate } = useSWR("uniza_grades", fetcher);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await mutate();
    setIsRefreshing(false);
  };

  const loading = !mounted || (isLoading && (!data || (data.winter.length === 0 && data.summer.length === 0)));

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);
  const grades = data || { winter: [], summer: [] };

  const current = grades[semester];

  const gradeClassMap: Record<string, string> = {
    A: "badge-a", B: "badge-b", C: "badge-c", D: "badge-d", E: "badge-e", FX: "badge-fx",
  };

  const gradeColorMap: Record<string, string> = {
    A: "var(--success)", B: "#5ac8fa", C: "var(--warning)", D: "var(--purple)", E: "var(--danger)", FX: "var(--danger)",
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

  return (
    <div>
      <div className="top-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="top-bar-title">{t("grades_title")}</div>
        <button
          type="button"
          aria-label={t("common_refresh") as string}
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            background: "var(--surface-secondary)",
            border: "none",
            padding: "8px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            opacity: isRefreshing ? 0.5 : 1
          }}
        >
          <svg className={isRefreshing ? "spin" : ""} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6"></path>
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
            <path d="M3 22v-6h6"></path>
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
          </svg>
        </button>
      </div>

      <div className="container">
        <div className="segment-control">
          <button type="button" aria-pressed={semester === "winter"} className={`segment-btn ${semester === "winter" ? "active" : ""}`} onClick={() => setSemester("winter")}>
            ❄️ {t("grades_winter")}
          </button>
          <button type="button" aria-pressed={semester === "summer"} className={`segment-btn ${semester === "summer" ? "active" : ""}`} onClick={() => setSemester("summer")}>
            ☀️ {t("grades_summer")}
          </button>
        </div>

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
            {/* Stats Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "24px" }}>
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

            {/* Grades List */}
            <div className="card-group">
              {current.map((item, idx) => {
                const displayGrade = item.grade || "—";
                const cls = gradeClassMap[displayGrade] || "";
                const color = gradeColorMap[displayGrade] || "var(--text-tertiary)";
                return (
                  <div key={idx} className="card-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="card-title" style={{ marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.subject}
                      </div>
                      <div className="text-xs" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <span>{item.code}</span>
                        {item.credits > 0 && <><span>·</span><span>{item.credits} {t("grades_credits_short")}</span></>}
                        {item.date && <><span>·</span><span>{item.date}</span></>}
                        {item.points && item.points !== "—" && item.points !== "" && <><span>·</span><span>{item.points} {t("grades_points_short")}</span></>}
                      </div>
                    </div>
                    <div
                      className={`grade-circle ${cls}`}
                      style={{
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
          </div>
        )}
      </div>
    </div>
  );
}
