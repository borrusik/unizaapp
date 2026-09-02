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
import { AppIcon, type AppIconName } from "@/components/AppIcon";

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
      icon: "book" as AppIconName,
    },
    {
      name: "WebKredit",
      href: UNIZA_URLS.catering,
      status: integration.catering,
      icon: "restaurant" as AppIconName,
    },
    { name: t("system_academic_calendar"), href: UNIZA_URLS.academicCalendar, icon: "calendar" as AppIconName },
    { name: t("system_campus_map"), href: UNIZA_URLS.campus, icon: "map-pin" as AppIconName },
    { name: t("system_helpdesk"), href: UNIZA_URLS.helpdesk, icon: "info" as AppIconName },
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
          className="icon-button"
        >
          <AppIcon name="refresh" size={20} className={isRefreshing ? "spin" : ""} />
        </button>
      </div>

      <div className="container animate-slide-up">
        <div className="profile-identity">
          <div className="avatar">
            {user.name && user.name !== "Načítavam..." ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
          </div>
          <div className="profile-identity-copy">
            <h2>{user.name}</h2>
            <p>{user.email}</p>
          </div>
        </div>

        <div className="profile-stats">
          <div className="profile-stat">
            <strong>{totalCredits}</strong>
            <span>ECTS</span>
          </div>
          <div className="profile-stat">
            <strong>{avgGrade}</strong>
            <span><ClientText n="profile_avg" /></span>
          </div>
          <div className="profile-stat">
            <strong>{passedSubjects}/{totalSubjects}</strong>
            <span><ClientText n="profile_completed" /></span>
          </div>
        </div>

        <div style={{ marginBottom: "8px", padding: "0 4px" }}>
          <span className="label"><ClientText n="profile_info" /></span>
        </div>
        <div className="profile-open-group">
          <div className="profile-open-row">
            <span className="profile-open-row-label"><ClientText n="profile_faculty" /></span>
            <span className="profile-open-row-value">{user.faculty}</span>
          </div>
          <div className="profile-open-row">
            <span className="profile-open-row-label"><ClientText n="profile_program" /></span>
            <span className="profile-open-row-value">{user.program}</span>
          </div>
          <div className="profile-open-row">
            <span className="profile-open-row-label"><ClientText n="profile_id" /></span>
            <span className="profile-open-row-value">{user.personalNumber}</span>
          </div>
          <div className="profile-open-row">
            <span className="profile-open-row-label"><ClientText n="profile_group" /></span>
            <span className="profile-open-row-value">{user.group}</span>
          </div>
          <div className="profile-open-row">
            <span className="profile-open-row-label"><ClientText n="profile_acad_year" /></span>
            <span className="profile-open-row-value">{user.academicYear}</span>
          </div>
        </div>

        <div style={{ marginBottom: "8px", padding: "0 4px" }}>
          <span className="label">{t("profile_systems")}</span>
        </div>
        <div className="profile-open-group" style={{ marginBottom: "12px" }}>
          {officialSystems.map((system) => (
            <a
              key={system.href}
              href={system.href}
              target="_blank"
              rel="noopener noreferrer"
              className="profile-open-row"
              style={{ textDecoration: "none" }}
            >
              <span className="profile-system-name">
                <AppIcon name={system.icon} size={19} />
                {system.name}
              </span>
              {typeof system.status === "boolean" ? (
                <span className={`badge ${system.status ? "badge-credits" : "badge-neutral"}`}>
                  {system.status ? t("integration_connected") : t("integration_reconnect")}
                </span>
              ) : (
                <AppIcon name="external-link" size={17} />
              )}
            </a>
          ))}
        </div>
        <p className="text-xs" style={{ margin: "0 4px 24px" }}>
          {integration.passwordStored
            ? t("integration_encrypted")
            : t("integration_session_only")}
        </p>

        <div className="profile-support">
          <a
            href="https://www.instagram.com/borrusik/"
            target="_blank"
            rel="noopener noreferrer"
            className="support-link"
          >
            <span className="support-link-icon"><AppIcon name="instagram" size={23} /></span>
            <span className="support-link-copy">
              <strong>{t("support_instagram")}</strong>
              <small>{t("support_instagram_hint")}</small>
            </span>
            <AppIcon name="external-link" size={17} />
          </a>
        </div>

        <LanguageSwitcher />
        <ThemeSwitcher />

        <LogoutButton />

        <div style={{ textAlign: "center", marginTop: "28px", color: "var(--text-tertiary)", fontSize: "12px" }}>
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
              borderBottom: "1px solid var(--border)",
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
