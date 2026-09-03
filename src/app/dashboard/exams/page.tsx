"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import { AppIcon } from "@/components/AppIcon";
import { AcademicPeriodControls } from "@/components/AcademicPeriodControls";
import { useTranslation, type Lang } from "@/hooks/useTranslation";
import type { ExamTerm } from "@/lib/aivs-exams";
import type { IntegrationOperationResult } from "@/lib/uniza-parsers";
import { downloadIcs } from "@/lib/calendar";
import { getBratislavaDateKey } from "@/lib/uniza-parsers";

const LOCALES: Record<Lang, string> = { sk: "sk-SK", en: "en-GB", uk: "uk-UA", ru: "ru-RU" };

function formatDate(term: ExamTerm, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${term.date}T12:00:00Z`));
}

function ExamRow({ term, locale, t, onAction }: { term: ExamTerm; locale: string; t: ReturnType<typeof useTranslation>["t"]; onAction: (term: ExamTerm, action: "register" | "cancel") => void }) {
  return (
    <article className="exam-row">
      <div className="exam-date"><strong>{new Date(`${term.date}T12:00:00Z`).getUTCDate()}</strong><span>{new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(`${term.date}T12:00:00Z`))}</span></div>
      <div className="exam-copy"><h3>{term.subject}</h3><p>{formatDate(term, locale)} · {term.time}{term.room ? ` · ${term.room}` : ""}</p><div className="exam-meta">{term.teacher ? <span><AppIcon name="user" size={14} />{term.teacher}</span> : null}{term.capacity !== null ? <span>{t("exams_capacity")}: {term.occupied ?? 0}/{term.capacity}</span> : null}</div>{term.note ? <small>{term.note}</small> : null}</div>
      <div className="exam-actions"><button type="button" className="icon-button" aria-label={t("exams_export") as string} onClick={() => downloadIcs([{ uid: `exam-${term.academicYearStart}-${term.id}`, title: term.subject, date: term.date, timeStart: term.time, location: term.room, description: [term.type, term.teacher, term.note].filter(Boolean).join(" · ") }], `uniza-${term.subjectCode || "exam"}.ics`)}><AppIcon name="download" size={18} /></button>{term.canRegister ? <button type="button" className="btn-compact" onClick={() => onAction(term, "register")}>{t("exams_register")}</button> : null}{term.canCancel ? <button type="button" className="text-action danger" onClick={() => onAction(term, "cancel")}>{t("exams_cancel")}</button> : null}</div>
    </article>
  );
}

export default function ExamsPage() {
  const { t, lang } = useTranslation();
  const [academicYearStart, setAcademicYearStart] = useState<number>();
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [selected, setSelected] = useState<{ term: ExamTerm; action: "register" | "cancel" } | null>(null);
  const [result, setResult] = useState<IntegrationOperationResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const stored = Number(window.localStorage.getItem("uniza:academic-year:v1"));
    if (Number.isInteger(stored) && stored > 2000) setAcademicYearStart(stored);
    setPreferencesReady(true);
  }, []);

  const { data, isLoading, mutate } = useSWR(preferencesReady ? ["uniza_exams", academicYearStart ?? "current"] : null, async () => (await import("@/lib/scraper")).getExamTerms(academicYearStart), { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false });
  const today = getBratislavaDateKey(new Date());
  const terms = useMemo(() => data?.terms || [], [data?.terms]);
  const upcoming = useMemo(() => terms.filter((term) => term.date >= today), [terms, today]);
  const past = useMemo(() => terms.filter((term) => term.date < today).toReversed(), [terms, today]);

  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try { await mutate(async () => (await import("@/lib/scraper")).getExamTerms(academicYearStart, true), { revalidate: false }); } finally { setIsRefreshing(false); }
  };

  const confirm = () => {
    if (!selected || pending) return;
    startTransition(async () => {
      const api = await import("@/lib/scraper");
      const operation = selected.action === "register" ? api.registerExam : api.cancelExam;
      const response = await operation(selected.term.id, selected.term.academicYearStart);
      setResult(response);
      setSelected(null);
      await mutate(() => api.getExamTerms(academicYearStart, true), { revalidate: false });
    });
  };

  const years = data?.academicYears || [];
  const selectedYear = data?.selectedStartYear || academicYearStart || 0;
  const rowProps = { locale: LOCALES[lang], t, onAction: (term: ExamTerm, action: "register" | "cancel") => setSelected({ term, action }) };

  return (
    <div>
      <div className="top-bar page-title-row"><div className="top-bar-title">{t("exams_title")}</div><button type="button" className="icon-button" onClick={refresh} disabled={isRefreshing} aria-label={t("common_refresh") as string}><AppIcon name="refresh" size={20} className={isRefreshing ? "spin" : ""} /></button></div>
      <div className="container">
        <AcademicPeriodControls academicYearLabel={t("common_academic_year") as string} years={years} selectedStartYear={selectedYear} onYearChange={(year) => { setAcademicYearStart(year); window.localStorage.setItem("uniza:academic-year:v1", String(year)); }} semester="winter" onSemesterChange={() => undefined} winterLabel="" summerLabel="" winterCount={0} summerCount={0} disabled={isLoading || years.length === 0} hideSemester />
        {result ? <div className={`operation-message ${result.status}`} role="status"><AppIcon name={result.status === "success" ? "check" : "warning"} size={19} /><span>{result.message}</span><button type="button" onClick={() => setResult(null)} aria-label="Close"><AppIcon name="x" size={17} /></button></div> : null}
        {!preferencesReady || isLoading && !data ? <div className="exam-list">{[1,2,3].map((item) => <div key={item} className="exam-row skeleton" />)}</div> : (
          <>
            <div className="section-heading-row"><h2>{t("exams_upcoming")}</h2>{upcoming.length > 0 ? <button type="button" className="text-action" onClick={() => downloadIcs(upcoming.map((term) => ({ uid: `exam-${term.academicYearStart}-${term.id}`, title: term.subject, date: term.date, timeStart: term.time, location: term.room, description: [term.type, term.teacher, term.note].filter(Boolean).join(" · ") })), "uniza-exams.ics")}><AppIcon name="download" size={16} />{t("exams_export")}</button> : null}</div>
            {upcoming.length ? <div className="exam-list">{upcoming.map((term) => <ExamRow key={term.id} term={term} {...rowProps} />)}</div> : <div className="empty-state compact"><AppIcon name="calendar" size={36} /><p>{t("exams_empty")}</p></div>}
            {past.length ? <details className="food-history-details exam-history"><summary><span>{t("exams_past")} ({past.length})</span><AppIcon name="chevron-down" size={19} /></summary><div className="exam-list">{past.map((term) => <ExamRow key={term.id} term={term} {...rowProps} />)}</div></details> : null}
          </>
        )}
      </div>
      {selected ? <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setSelected(null); }}><section className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="exam-dialog-title"><div className="dialog-icon"><AppIcon name="calendar" size={24} /></div><h2 id="exam-dialog-title">{selected.action === "register" ? t("exams_confirm_register") : t("exams_confirm_cancel")}</h2><p>{selected.term.subject}</p><dl><div><dt>{formatDate(selected.term, LOCALES[lang])}</dt><dd>{selected.term.time}</dd></div>{selected.term.room ? <div><dt>{t("system_campus_map")}</dt><dd>{selected.term.room}</dd></div> : null}{selected.term.deadline ? <div><dt>Deadline</dt><dd>{selected.term.deadline}</dd></div> : null}</dl><div className="dialog-actions"><button type="button" className="btn-secondary" onClick={() => setSelected(null)} disabled={pending}>{t("food_close")}</button><button type="button" className={selected.action === "cancel" ? "btn-danger" : "btn-primary"} onClick={confirm} disabled={pending}>{pending ? "…" : selected.action === "register" ? t("exams_register") : t("exams_cancel")}</button></div></section></div> : null}
    </div>
  );
}
