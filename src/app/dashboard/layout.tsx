"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation, dictionary } from "@/hooks/useTranslation";
import { useState, useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const tabs = [
    {
      href: "/dashboard",
      labelKey: "nav_subjects" as keyof typeof dictionary.sk,
      icon: (
        <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      href: "/dashboard/schedule",
      labelKey: "nav_schedule" as keyof typeof dictionary.sk,
      icon: (
        <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      href: "/dashboard/grades",
      labelKey: "nav_grades" as keyof typeof dictionary.sk,
      icon: (
        <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
    },
    {
      href: "/dashboard/food",
      labelKey: "nav_food" as keyof typeof dictionary.sk,
      icon: (
        <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 2v20" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </svg>
      ),
    },
    {
      href: "/dashboard/profile",
      labelKey: "nav_profile" as keyof typeof dictionary.sk,
      icon: (
        <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  const [isBooting, setIsBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);

  useEffect(() => {
    const boot = async () => {
      const hasCaches = localStorage.getItem("uniza_subjects_cache");
      // If we already have cache, we don't block the UI
      if (hasCaches) {
        setIsBooting(false);
        return;
      }

      // If missing, show loading bar and warm up all caches concurrently!
      setBootProgress(10);
      const { getSubjects, getSchedule, getGrades, getUserInfo } = await import("@/lib/scraper");
      const { getStravaInfo, getStravaMenu, getStravaHistory } = await import("@/lib/strava");

      setBootProgress(35);

      try {
        const [subjects, schedule, grades, userInfo, stravaInfo, stravaMenu, stravaHist] = await Promise.all([
          getSubjects(),
          getSchedule(),
          getGrades(),
          getUserInfo(),
          getStravaInfo(),
          getStravaMenu(),
          getStravaHistory()
        ]);

        setBootProgress(85);

        localStorage.setItem("uniza_subjects_cache", JSON.stringify(subjects));
        localStorage.setItem("uniza_schedule_cache", JSON.stringify(schedule));
        localStorage.setItem("uniza_grades_cache", JSON.stringify(grades));
        localStorage.setItem("uniza_user_info", JSON.stringify(userInfo));
        localStorage.setItem("uniza_strava_info", JSON.stringify(stravaInfo || { balance: 0.00, name: "Student" }));
        localStorage.setItem("uniza_strava_menu", JSON.stringify(stravaMenu || []));
        localStorage.setItem("uniza_strava_history", JSON.stringify(stravaHist || []));
      } catch (e) {
        console.error("Bootload failed", e);
      }

      setBootProgress(100);
      setTimeout(() => setIsBooting(false), 600);
    };
    boot();
  }, []);

  return (
    <div className="page-with-nav">
      <main>
        {isBooting ? (
          <div>
            <div className="top-bar">
              <div className="skeleton" style={{ width: "140px", height: "28px", borderRadius: "8px" }} />
            </div>
            <div className="container">
              <div className="segment-control skeleton" style={{ height: "42px", display: "flex", gap: "4px", padding: "4px" }}>
                <div style={{ flex: 1, borderRadius: "8px" }} />
                <div style={{ flex: 1, borderRadius: "8px" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", padding: "0 4px" }}>
                <div className="skeleton" style={{ width: "80px", height: "16px" }} />
                <div className="skeleton" style={{ width: "100px", height: "22px", borderRadius: "12px" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="card skeleton" style={{ height: "90px" }} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          children
        )}
      </main>

      <nav className="bottom-nav">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`nav-item ${isActive ? "active" : ""}`}
            >
              {tab.icon}
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
