"use client";

import { useState, useEffect } from "react";
import { getSubjectInfo, type SubjectInfo } from "@/lib/scraper";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { AppIcon, type AppIconName } from "@/components/AppIcon";

function SubjectInfoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const url = searchParams.get("url") || "";
  const subjectName = searchParams.get("name") || "Predmet";
  const { t } = useTranslation();

  const [info, setInfo] = useState<SubjectInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (url) {
      getSubjectInfo(url)
        .then(setInfo)
        .finally(() => setLoading(false));
    }
  }, [url]);

  const sections = info
    ? [
      { label: t("subject_credits"), value: info.credits, icon: "award" as AppIconName },
      { label: t("subject_type"), value: info.obligation, icon: "pin" as AppIconName },
      { label: t("subject_completion"), value: info.completion, icon: "check" as AppIconName },
    ].filter((s) => s.value)
    : [];

  const details = info
    ? [
      { title: t("subject_teaching"), content: info.hours },
      { title: t("subject_workload"), content: info.workload },
      { title: t("subject_conditions"), content: info.conditions },
      { title: t("subject_outcomes"), content: info.outcomes },
      { title: t("subject_syllabus"), content: info.syllabus },
      { title: t("subject_literature"), content: info.literature },
      { title: t("subject_teacher"), content: info.teacher },
      { title: t("subject_guarantor"), content: info.guarantor },
    ].filter((d) => d.content)
    : [];

  return (
    <div style={{ paddingBottom: "40px" }}>
      {/* Premium Header */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "var(--background)",
        borderBottom: "1px solid var(--border)",
        padding: "16px 20px 16px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
      }}>
        <button
          type="button"
          aria-label={t("common_back") as string}
          onClick={() => router.back()}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "var(--surface)",
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--border)",
            flexShrink: 0,
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
        >
          <AppIcon name="arrow-left" size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}>
            {info ? info.name : subjectName}
          </div>
          {info?.code && (
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px", fontWeight: 500 }}>
              {info.code}
            </div>
          )}
        </div>
      </div>

      <div className="container" style={{ marginTop: "24px" }}>
        {loading ? (
          <div className="fullscreen-loader">
            <div className="spinner"></div>
          </div>
        ) : !info ? (
          <div className="empty-state" style={{ paddingTop: "80px" }}>
            <AppIcon name="book" size={48} />
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
              {t("subject_not_found_title")}
            </div>
            <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "15px" }}>
              {t("subject_not_found_desc")}
            </p>
          </div>
        ) : (
          <div className="animate-slide-up" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* Hero Card */}
            <div style={{
              background: "var(--surface)",
              borderRadius: "24px",
              padding: "24px",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-md)",
              position: "relative",
              overflow: "hidden"
            }}>
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  background: "var(--primary-light)",
                  color: "var(--primary)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  marginBottom: "12px"
                }}>
                  {info.obligation || t("subject_type_default")}
                </div>
                <h1 style={{
                  fontSize: "28px",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  lineHeight: 1.2,
                  marginBottom: "8px",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                  hyphens: "auto"
                }}>
                  {info.name}
                </h1>
                {info.faculty && (
                  <div style={{ fontSize: "15px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <AppIcon name="building" size={16} />
                    {info.faculty}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats Grid */}
            {sections.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${sections.length}, 1fr)`, gap: "12px" }}>
                {sections.map((s, i) => (
                  <div key={i} style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-sm)",
                    borderRadius: "20px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center"
                  }}>
                    <AppIcon name={s.icon} size={24} style={{ marginBottom: "8px", color: "var(--primary-hover)" }} />
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1, marginBottom: "4px" }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Detail Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {details.map((section, idx) => (
                <div key={idx} style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-sm)",
                  borderRadius: "24px",
                  padding: "20px",
                }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "12px",
                  }}>
                    <div style={{ width: "4px", height: "16px", background: "var(--primary)", borderRadius: "4px" }} />
                    <h3 style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "var(--primary)",
                      margin: 0
                    }}>
                      {section.title}
                    </h3>
                  </div>
                  <div style={{
                    fontSize: "15px",
                    lineHeight: 1.6,
                    color: "var(--text-primary)",
                    whiteSpace: "pre-wrap",
                    wordWrap: "break-word",
                    overflowWrap: "anywhere",
                    hyphens: "auto",
                  }}>
                    {section.content}
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default function SubjectInfoPage() {
  return (
    <Suspense fallback={
      <div className="container" style={{ paddingTop: "80px" }}>
        <div className="skeleton" style={{ height: "200px", borderRadius: "var(--radius-md)" }} />
      </div>
    }>
      <SubjectInfoContent />
    </Suspense>
  );
}
