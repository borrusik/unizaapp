"use client";

import Link from "next/link";
import { getUserInfo, getGrades, getIntegrationStatus } from "@/lib/scraper";
import { LogoutButton } from "./LogoutButton";
import { ClientText } from "@/components/ClientText";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useState } from "react";
import useSWR from "swr";
import { useTranslation } from "@/hooks/useTranslation";
import { AppIcon } from "@/components/AppIcon";
import { BrowserNotifications } from "./BrowserNotifications";

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

        <div className="profile-open-group" style={{ marginBottom: "12px" }}>
          <div className="profile-open-row"><span className="profile-system-name"><AppIcon name="book" size={19} />AIVS</span><span className={`badge ${integration.education ? "badge-credits" : "badge-neutral"}`}>{integration.education ? t("integration_connected") : t("integration_reconnect")}</span></div>
          <div className="profile-open-row"><span className="profile-system-name"><AppIcon name="restaurant" size={19} />WebKredit</span><span className={`badge ${integration.catering ? "badge-credits" : "badge-neutral"}`}>{integration.catering ? t("integration_connected") : t("integration_reconnect")}</span></div>
          <Link href="/dashboard/services" className="profile-open-row" style={{ textDecoration: "none" }}><span className="profile-system-name"><AppIcon name="building" size={19} />{t("services_title")}</span><AppIcon name="chevron-right" size={17} /></Link>
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
        <BrowserNotifications />

        <LogoutButton />

      </div>
    </div>
  );
}
