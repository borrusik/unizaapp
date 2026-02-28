"use client";

import { getUserInfo, getGrades } from "@/lib/scraper";
import { LogoutButton } from "./LogoutButton";
import { ClientText } from "@/components/ClientText";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useState, useEffect } from "react";
import useSWR from "swr";

export default function ProfilePage() {
  const [mounted, setMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetcher = async () => {
    const [user, gradesRes] = await Promise.all([
      getUserInfo(),
      getGrades().catch(() => ({ winter: [], summer: [] }))
    ]);
    const res = { user, grades: gradesRes || { winter: [], summer: [] } };
    try {
      localStorage.setItem("uniza_user_cache", JSON.stringify(res));
    } catch { }
    return res;
  };

  const { data, isLoading, mutate } = useSWR("uniza_user_profile", fetcher, {
    fallbackData: typeof window !== "undefined"
      ? (() => {
        try {
          const cached = localStorage.getItem("uniza_user_cache");
          if (cached) return JSON.parse(cached);

          // Also fallback to the ones created by the bootloader
          const bootUser = localStorage.getItem("uniza_user_info");
          const bootGrades = localStorage.getItem("uniza_grades_cache");
          if (bootUser && bootGrades) {
            return { user: JSON.parse(bootUser), grades: JSON.parse(bootGrades) };
          }
        } catch { }
        return { user: null, grades: { winter: [], summer: [] } };
      })()
      : { user: null, grades: { winter: [], summer: [] } },
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
  });

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await mutate();
    setIsRefreshing(false);
  };

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

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

  const allGrades = [...grades.winter, ...grades.summer];
  const totalCredits = allGrades
    .filter((g) => g.grade && g.grade !== "—" && g.grade !== "FX" && g.grade !== "")
    .reduce((sum, g) => sum + g.credits, 0);
  const totalSubjects = allGrades.length;
  const passedSubjects = allGrades.filter((g) => g.grade && g.grade !== "—" && g.grade !== "FX" && g.grade !== "").length;

  const gradeValues: Record<string, number> = { A: 1, B: 1.5, C: 2, D: 2.5, E: 3, FX: 4 };
  const scored = allGrades.filter((g) => gradeValues[g.grade] !== undefined);
  const avgGrade = scored.length > 0
    ? (scored.reduce((sum, g) => sum + gradeValues[g.grade] * g.credits, 0) / scored.reduce((sum, g) => sum + g.credits, 0)).toFixed(2)
    : "—";

  return (
    <div>
      <div className="top-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="top-bar-title"><ClientText n="profile_title" /></div>
        <button
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

        <LanguageSwitcher />

        <LogoutButton />

        <div style={{
          textAlign: "center",
          marginTop: "28px",
          color: "var(--text-tertiary)",
          fontSize: "12px",
        }}>
          <p>UNIZA Student App v1.0</p>
          <a
            href="https://instagram.com/borrusik"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              marginTop: "4px",
              color: "var(--primary)",
              textDecoration: "none",
              fontWeight: 500
            }}
          >
            Developed by @borrusik
          </a>
        </div>
      </div>
    </div>
  );
}
