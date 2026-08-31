"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/lib/scraper";
import { useTranslation } from "@/hooks/useTranslation";

export function LogoutButton() {
  const router = useRouter();
  const { t } = useTranslation();

  const handleLogout = async () => {
    await logout();
    [
      "uniza_subjects_cache",
      "uniza_schedule_cache",
      "uniza_grades_cache",
      "uniza_user_cache",
      "uniza_user_info",
      "uniza_strava_info",
      "uniza_strava_menu",
      "uniza_strava_history",
    ].forEach((key) => localStorage.removeItem(key));
    router.push("/");
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      style={{
        width: "100%",
        padding: "14px",
        borderRadius: "var(--radius-md)",
        background: "var(--danger-light)",
        color: "var(--danger)",
        fontSize: "16px",
        fontWeight: 600,
        textAlign: "center",
        transition: "opacity 0.2s",
      }}
    >
      {t("profile_logout")}
    </button>
  );
}
