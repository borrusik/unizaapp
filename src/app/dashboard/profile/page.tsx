"use client";

import Link from "next/link";
import { getProfileDashboard } from "@/lib/profile";
import { LogoutButton } from "./LogoutButton";
import { ClientText } from "@/components/ClientText";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useState } from "react";
import useSWR from "swr";
import { useTranslation } from "@/hooks/useTranslation";
import { AppIcon } from "@/components/AppIcon";
import { BrowserNotifications } from "./BrowserNotifications";
import { IntegrationErrorNotice } from "@/components/IntegrationErrorNotice";
import { useGradeOverrides } from "@/hooks/useGradeOverrides";
import { applyGradeOverrides, gradeSummary } from "@/lib/grade-overrides";

export default function ProfilePage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<unknown>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { t, lang } = useTranslation();

  const fetcher = (force = false) => getProfileDashboard(force);

  const { data, error, mutate } = useSWR("uniza_user_profile", () => fetcher(false), { dedupingInterval: 5 * 60_000, revalidateOnFocus: false });
  const { overrides } = useGradeOverrides(data?.grades.accountKey);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      await mutate(() => fetcher(true), { revalidate: false });
    } catch (failure) {
      setRefreshError(failure);
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
    mail: false,
    passwordStored: false,
  };

  const allGrades = applyGradeOverrides([...grades.winter, ...grades.summer], overrides);
  const { credits: totalCredits, average: avgGrade, passed: passedSubjects } = gradeSummary(allGrades);
  const totalSubjects = allGrades.length;

  const copyProfileValue = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField((current) => current === field ? null : current), 1600);
    } catch {
      // Clipboard access can be denied by browser or OS policy. Keep the row
      // usable without surfacing an unhandled promise rejection.
    }
  };

  const profileFields = [
    { id: "faculty", label: t("profile_faculty"), value: user.faculty },
    { id: "program", label: t("profile_program"), value: user.program },
    { id: "personalNumber", label: t("profile_id"), value: user.personalNumber },
    { id: "group", label: t("profile_group"), value: user.group },
    { id: "academicYear", label: t("profile_acad_year"), value: user.academicYear },
  ];

  return (
    <div className="dashboard-page dashboard-page-profile">
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

      <div className="container profile-page animate-slide-up">
        <IntegrationErrorNotice error={error || refreshError} hasData={Boolean(data)} retry={() => void handleRefresh()} />
        <div className="profile-identity">
          <div className="avatar">
            {user.name && user.name !== "Načítavam..." ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
          </div>
          <div className="profile-identity-copy">
            <h2>{user.name}</h2>
            <p>{user.email}</p>
          </div>
        </div>

        <p className="text-sm">{lang === "ru" ? "За всё обучение" : lang === "uk" ? "За все навчання" : lang === "sk" ? "Za celé štúdium" : "All study years"}</p>
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
          {profileFields.map((field) => {
            const copied = copiedField === field.id;
            return (
              <button
                key={field.id}
                type="button"
                className="profile-open-row profile-copy-row"
                aria-label={`${copied ? t("common_copied") : t("common_copy")}: ${field.label}`}
                onClick={() => copyProfileValue(field.id, field.value)}
              >
                <span className="profile-open-row-label">{field.label}</span>
                <span className="profile-copy-value">
                  <span className="profile-open-row-value">{field.value}</span>
                  <AppIcon name={copied ? "check" : "clipboard"} size={17} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="profile-open-group" style={{ marginBottom: "12px" }}>
          <div className="profile-open-row"><span className="profile-system-name"><AppIcon name="book" size={19} />AIVS</span><span className={`badge ${integration.education ? "badge-credits" : "badge-neutral"}`}>{integration.education ? t("integration_connected") : t("integration_reconnect")}</span></div>
          <div className="profile-open-row"><span className="profile-system-name"><AppIcon name="restaurant" size={19} />WebKredit</span><span className={`badge ${integration.catering ? "badge-credits" : "badge-neutral"}`}>{integration.catering ? t("integration_connected") : t("integration_reconnect")}</span></div>
          <Link prefetch={false} href="/dashboard/mail" className="profile-open-row" style={{ textDecoration: "none" }}><span className="profile-system-name"><AppIcon name="mail" size={19} />{t("services_mail")}</span><span className={`badge ${integration.mail ? "badge-credits" : "badge-neutral"}`}>{integration.mail ? t("integration_connected") : t("integration_reconnect")}</span></Link>
          <Link prefetch={false} href="/dashboard/services" className="profile-open-row" style={{ textDecoration: "none" }}><span className="profile-system-name"><AppIcon name="building" size={19} />{t("services_title")}</span><AppIcon name="chevron-right" size={17} /></Link>
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
