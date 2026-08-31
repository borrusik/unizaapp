"use client";

import { getUserInfo, getGrades, getIntegrationStatus } from "@/lib/scraper";
import { LogoutButton } from "./LogoutButton";
import { ClientText } from "@/components/ClientText";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useState } from "react";
import useSWR from "swr";
import { UNIZA_URLS } from "@/lib/uniza";
import { useTranslation } from "@/hooks/useTranslation";

export default function ProfilePage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { t } = useTranslation();

  const fetcher = async (force = false) => {
    const [user, gradesRes, integration] = await Promise.all([
      getUserInfo(undefined, undefined, force),
      getGrades(undefined, force).catch(() => ({ winter: [], summer: [] })),
      getIntegrationStatus(),
    ]);
    return { user, grades: gradesRes || { winter: [], summer: [] }, integration };
  };

  const { data, mutate } = useSWR("uniza_user_profile", () => fetcher(false));

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await mutate(() => fetcher(true), { revalidate: false });
    } finally {
      setIsRefreshing(false);
    }
  };


  const user = data?.user || {
    name: "Načítavam...",
    email: "...",
    faculty: "...",
    program: "...",
    group: "...",
    academicYear: "...",
    personalNumber: "..."
  };
  const grades = data?.grades || { winter: [], summer: [] };
  const integration = data?.integration || {
    education: false,
    catering: false,
    passwordStored: false,
  };

  const allGrades = [...grades.winter, ...grades.summer];
  const totalCredits = allGrades
    .filter((g) => g.grade && g.grade !== "—" && g.grade !== "FX" && g.grade !== "")
    .reduce((sum, g) => sum + g.credits, 0);
  const totalSubjects = allGrades.length;
  const passedSubjects = allGrades.filter((g) => g.grade && g.grade !== "—" && g.grade !== "FX" && g.grade !== "").length;

  const gradeValues: Record<string, number> = { A: 1, B: 1.5, C: 2, D: 2.5, E: 3, FX: 4 };
  const scored = allGrades.filter((g) => gradeValues[g.grade] !== undefined);
  const scoredCredits = scored.reduce((sum, g) => sum + g.credits, 0);
  const avgGrade = scored.length > 0 && scoredCredits > 0
    ? (scored.reduce((sum, g) => sum + gradeValues[g.grade] * g.credits, 0) / scoredCredits).toFixed(2)
    : "—";

  const officialSystems = [
    {
      name: "AIVS / Vzdelávanie",
      href: UNIZA_URLS.education,
      status: integration.education,
    },
    {
      name: "WebKredit",
      href: UNIZA_URLS.catering,
      status: integration.catering,
    },
    { name: t("system_academic_calendar"), href: UNIZA_URLS.academicCalendar },
    { name: t("system_campus_map"), href: UNIZA_URLS.campus },
    { name: t("system_helpdesk"), href: UNIZA_URLS.helpdesk },
  ];

  return (
    <div>
      <div className="top-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="top-bar-title"><ClientText n="profile_title" /></div>
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

      <div className="container animate-slide-up">
        {/* Profile Header */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: "28px",
          padding: "8px 0",
        }}>
          <div className="avatar">
            {user.name && user.name !== "Načítavam..." ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: 700, marginTop: "14px", marginBottom: "2px" }}>
            {user.name}
          </h2>
          <p className="text-sm">{user.email}</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "24px" }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--primary)", fontSize: "24px" }}>{totalCredits}</div>
            <div className="stat-label">ECTS</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--success)", fontSize: "24px" }}>{avgGrade}</div>
            <div className="stat-label"><ClientText n="profile_avg" /></div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--warning)", fontSize: "24px" }}>{passedSubjects}/{totalSubjects}</div>
            <div className="stat-label"><ClientText n="profile_completed" /></div>
          </div>
        </div>

        {/* Info Card Group */}
        <div style={{ marginBottom: "8px", padding: "0 4px" }}>
          <span className="label"><ClientText n="profile_info" /></span>
        </div>
        <div className="card-group" style={{ marginBottom: "24px" }}>
          <div className="card-row" style={{ cursor: "default" }}>
            <span className="text-sm" style={{ color: "var(--text-primary)", fontWeight: 500 }}><ClientText n="profile_faculty" /></span>
            <span className="text-sm" style={{ textAlign: "right", maxWidth: "200px" }}>{user.faculty}</span>
          </div>
          <div className="card-row" style={{ cursor: "default" }}>
            <span className="text-sm" style={{ color: "var(--text-primary)", fontWeight: 500 }}><ClientText n="profile_program" /></span>
            <span className="text-sm">{user.program}</span>
          </div>
          <div className="card-row" style={{ cursor: "default" }}>
            <span className="text-sm" style={{ color: "var(--text-primary)", fontWeight: 500 }}><ClientText n="profile_id" /></span>
            <span className="text-sm">{user.personalNumber}</span>
          </div>
          <div className="card-row" style={{ cursor: "default" }}>
            <span className="text-sm" style={{ color: "var(--text-primary)", fontWeight: 500 }}><ClientText n="profile_group" /></span>
            <span className="text-sm">{user.group}</span>
          </div>
          <div className="card-row" style={{ cursor: "default" }}>
            <span className="text-sm" style={{ color: "var(--text-primary)", fontWeight: 500 }}><ClientText n="profile_acad_year" /></span>
            <span className="text-sm">{user.academicYear}</span>
          </div>
        </div>

        <div style={{ marginBottom: "8px", padding: "0 4px" }}>
          <span className="label">{t("profile_systems")}</span>
        </div>
        <div className="card-group" style={{ marginBottom: "12px" }}>
          {officialSystems.map((system) => (
            <a
              key={system.href}
              href={system.href}
              target="_blank"
              rel="noopener noreferrer"
              className="card-row"
              style={{ textDecoration: "none" }}
            >
              <span className="text-sm" style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {system.name}
              </span>
              {typeof system.status === "boolean" ? (
                <span className={`badge ${system.status ? "badge-credits" : "badge-neutral"}`}>
                  {system.status ? t("integration_connected") : t("integration_reconnect")}
                </span>
              ) : (
                <span aria-hidden="true">↗</span>
              )}
            </a>
          ))}
        </div>
        <p className="text-xs" style={{ margin: "0 4px 24px" }}>
          {integration.passwordStored
            ? t("integration_encrypted")
            : t("integration_session_only")}
        </p>

        <LanguageSwitcher />
        <ThemeSwitcher />

        <LogoutButton />

        <div style={{
          textAlign: "center",
          marginTop: "28px",
          color: "var(--text-tertiary)",
          fontSize: "12px",
        }}>
          <p>UNIZA Student App v1.0</p>
          <a
            href="https://github.com/borrusik/unizaapp"
            target="_blank"
            rel="noopener noreferrer"
            className="hover-scale"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "16px",
              color: "var(--text-secondary)",
              textDecoration: "none",
              fontWeight: 500,
              padding: "6px 16px",
              borderRadius: "20px",
              background: "var(--surface-secondary)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"></path>
            </svg>
            Source Code on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
