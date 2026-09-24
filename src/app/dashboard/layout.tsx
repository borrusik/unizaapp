"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useTranslation, type TranslationKey } from "@/hooks/useTranslation";
import { AppIcon, type AppIconName } from "@/components/AppIcon";
import { BrowserNotificationScheduler } from "./profile/BrowserNotifications";
import { DashboardSessionGuard } from "@/components/DashboardSessionGuard";
import { KharkivEasterEgg } from "@/components/KharkivEasterEgg";

interface NavTab {
  href: string;
  labelKey: TranslationKey;
  icon: AppIconName;
  matchExact?: boolean;
}

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

  // Mobile navigation tabs
  const mobileTabs: NavTab[] = [
    { href: "/dashboard", labelKey: "nav_home", icon: "home", matchExact: true },
    { href: "/dashboard/schedule", labelKey: "nav_schedule", icon: "calendar" },
    { href: "/dashboard/subjects", labelKey: "nav_study", icon: "book" },
    { href: "/dashboard/food", labelKey: "nav_food", icon: "restaurant" },
    { href: "/dashboard/mail", labelKey: "nav_mail", icon: "mail" },
  ];

  // Desktop sidebar navigation links
  const desktopNavLinks: Array<{ href: string; labelKey: TranslationKey; icon: AppIconName; matchExact?: boolean }> = [
    { href: "/dashboard", labelKey: "nav_home", icon: "home", matchExact: true },
    { href: "/dashboard/schedule", labelKey: "nav_schedule", icon: "calendar" },
    { href: "/dashboard/subjects", labelKey: "nav_subjects", icon: "book" },
    { href: "/dashboard/grades", labelKey: "nav_grades", icon: "award" },
    { href: "/dashboard/exams", labelKey: "home_exams", icon: "clipboard" },
    { href: "/dashboard/food", labelKey: "nav_food", icon: "restaurant" },
    { href: "/dashboard/mail", labelKey: "nav_mail", icon: "mail" },
    { href: "/dashboard/services", labelKey: "home_services", icon: "building" },
    { href: "/dashboard/profile", labelKey: "nav_profile", icon: "user" },
  ];

  const isTabActive = (tab: NavTab) => {
    if (tab.matchExact) return pathname === tab.href;
    if (tab.href === "/dashboard/subjects") {
      return ["/dashboard/subjects", "/dashboard/subject"].some((p) => pathname.startsWith(p));
    }
    return pathname.startsWith(tab.href);
  };

  return (
    <DashboardSessionGuard>
    <div className="page-with-nav">
      <BrowserNotificationScheduler />
      {/* Desktop Sidebar */}
      <aside className="desktop-sidebar">
        <div className="desktop-sidebar-brand">
          <KharkivEasterEgg className="desktop-sidebar-logo" iconSize={21} />
          <div>
            <div className="desktop-sidebar-title">UNIZA Student</div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>Portál študenta</div>
          </div>
        </div>

        <nav className="desktop-sidebar-nav" aria-label="Desktop navigation">
          {desktopNavLinks.map((link) => {
            const active = link.matchExact
              ? pathname === link.href
              : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className={`desktop-nav-link ${active ? "active" : ""}`}
              >
                <AppIcon name={link.icon} size={19} />
                <span>{t(link.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* Main Content Area */}
      <div className="dashboard-main">
        <main>{children}</main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav" aria-label="Mobile bottom navigation">
        {mobileTabs.map((tab) => {
          const active = isTabActive(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={false}
              className={`nav-item ${active ? "active" : ""}`}
            >
              <AppIcon name={tab.icon} className="nav-icon" />
              <span>{t(tab.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
    </DashboardSessionGuard>
  );
}
