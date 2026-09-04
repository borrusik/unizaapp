"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useTranslation, dictionary } from "@/hooks/useTranslation";
import { AppIcon, type AppIconName } from "@/components/AppIcon";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  const tabs: Array<{ href: string; labelKey: keyof typeof dictionary.sk; icon: AppIconName }> = [
    {
      href: "/dashboard",
      labelKey: "nav_home",
      icon: "home",
    },
    {
      href: "/dashboard/subjects",
      labelKey: "nav_study",
      icon: "book",
    },
    {
      href: "/dashboard/profile",
      labelKey: "nav_profile",
      icon: "user",
    },
  ];

  return (
    <div className="page-with-nav">
      <main>{children}</main>

      <nav className="bottom-nav">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
            || (tab.href === "/dashboard/subjects" && [
              "/dashboard/schedule",
              "/dashboard/grades",
              "/dashboard/exams",
              "/dashboard/subject",
            ].some((prefix) => pathname.startsWith(prefix)));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`nav-item ${isActive ? "active" : ""}`}
            >
              <AppIcon name={tab.icon} className="nav-icon" />
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
