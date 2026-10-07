"use client";

import { useState } from "react";
import { getGrades } from "@/lib/scraper";
import type { Grade } from "@/lib/scraper";
import { useTranslation } from "@/hooks/useTranslation";
import { AcademicPeriodControls } from "@/components/AcademicPeriodControls";
import { AppIcon } from "@/components/AppIcon";
import useSWR from "swr";
import { IntegrationErrorNotice } from "@/components/IntegrationErrorNotice";
import { useGradeOverrides } from "@/hooks/useGradeOverrides";
import { applyGradeOverrides, gradeSummary, PERSONAL_GRADES, type PersonalGrade } from "@/lib/grade-overrides";

export default function GradesPage() {
  const [semester, setSemester] = useState<"winter" | "summer">("winter");
  const [academicYearStart, setAcademicYearStart] = useState<number | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const stored = Number(window.localStorage.getItem("uniza:academic-year:v1"));
    return Number.isInteger(stored) && stored > 2000 ? stored : undefined;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<unknown>(null);
  const { t, lang } = useTranslation();
  const [editing, setEditing] = useState<Grade | null>(null);
  const [draftGrade, setDraftGrade] = useState<PersonalGrade>("—");
  const [editError, setEditError] = useState(false);
  const personalCopy = {
    ru: ["Личная поправка", "Меняет только расчёты приложения, не AIVS. Сохраняется для этого аккаунта в этом браузере.", "Оценка", "Сохранить", "Вернуть AIVS", "Отмена", "Хранилище браузера недоступно.", "Закрыт без оценки"],
    uk: ["Особиста поправка", "Змінює лише розрахунки застосунку, не AIVS. Зберігається для цього акаунта в цьому браузері.", "Оцінка", "Зберегти", "Повернути AIVS", "Скасувати", "Сховище браузера недоступне.", "Зараховано без оцінки"],
    sk: ["Osobná úprava", "Mení iba výpočty aplikácie, nie AIVS. Ukladá sa pre tento účet v tomto prehliadači.", "Známka", "Uložiť", "Obnoviť AIVS", "Zrušiť", "Úložisko prehliadača nie je dostupné.", "Absolvované bez známky"],
    en: ["Personal correction", "Changes app calculations only, not AIVS. Saved for this account in this browser.", "Grade", "Save", "Restore AIVS", "Cancel", "Browser storage is unavailable.", "Passed without a grade"],
  }[lang];

  const fetcher = async () => getGrades(academicYearStart);

  const { data, error, isLoading, mutate } = useSWR(
    ["uniza_grades", academicYearStart ?? "current"],
    fetcher,
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false },
  );
  const { overrides, setGrade } = useGradeOverrides(data?.accountKey);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      await mutate(() => getGrades(academicYearStart, true), { revalidate: false });
    } catch (failure) {
      setRefreshError(failure);
    } finally {
      setIsRefreshing(false);
    }
  };

  const loading = (isLoading || isRefreshing) && (!data || (data.winter.length === 0 && data.summer.length === 0));

  const grades = data || {
    winter: [],
    summer: [],
    academicYear: "",
    academicYears: [],
    selectedStartYear: academicYearStart || 0,
  };

  const allForSemester = applyGradeOverrides(grades[semester], overrides);
  const current = allForSemester.filter(
    (grade) => grade.academicYearStart === grades.selectedStartYear,
  );
  const currentYear = applyGradeOverrides([...grades.winter, ...grades.summer], overrides).filter(
    (grade) => grade.academicYearStart === grades.selectedStartYear,
  );
  const completed = current.filter((grade) => grade.grade && grade.grade !== "—");
  const pending = current.filter((grade) => !grade.grade || grade.grade === "—");

  const gradeClassMap: Record<string, string> = {
    A: "badge-a", B: "badge-b", C: "badge-c", D: "badge-d", E: "badge-e", FX: "badge-fx",
  };

  const gradeColorMap: Record<string, string> = {
    A: "var(--success)", B: "#5ac8fa", C: "var(--warning)", D: "var(--purple)", E: "var(--orange)", FX: "var(--danger)",
  };

  const { credits: earnedCredits, average: avgGrade, passed: passedCount } = gradeSummary(currentYear);
  const savePersonalGrade = (grade: PersonalGrade | null) => {
    if (!editing) return;
    try { setGrade(editing, grade); setEditing(null); setEditError(false); }
    catch { setEditError(true); }
  };

  const renderGradeRows = (items: typeof current) => (
    <div className="card-group">
      {items.map((item) => {
        const displayGrade = item.grade || "—";
        const cls = gradeClassMap[displayGrade] || "";
        const color = gradeColorMap[displayGrade] || "var(--text-tertiary)";
        return (
          <div key={`${item.code}-${item.date}-${item.type}`} className="card-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="card-title grade-subject-title" style={{ fontSize: "15px", fontWeight: 650 }}>
                {item.subject}
              </div>
              <div className="text-xs grade-meta" style={{ marginTop: "3px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <span>{item.code}</span>
                {item.credits > 0 && <><span>·</span><span>{item.credits} {t("grades_credits_short")}</span></>}
                {item.date && <><span>·</span><span>{item.date}</span></>}
                {item.points && item.points !== "—" && item.points !== "" && <><span>·</span><span>{item.points} {t("grades_points_short")}</span></>}
              </div>
              {item.localOverride ? <small className="personal-grade-label">{personalCopy[0]} · AIVS: {item.originalGrade || "—"}</small> : null}
            </div>
            <button
              type="button"
              aria-label={`${personalCopy[0]}: ${item.subject}`}
              title={personalCopy[0]}
              onClick={() => { setEditing(item); setDraftGrade(PERSONAL_GRADES.includes(item.grade as PersonalGrade) ? item.grade as PersonalGrade : "—"); setEditError(false); }}
              className={`grade-circle ${cls}`}
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: "15px",
                background: displayGrade === "—" ? "var(--surface-secondary)" : undefined,
                color: displayGrade === "—" ? "var(--text-tertiary)" : color,
              }}
            >
              {displayGrade}
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="dashboard-page dashboard-page-standard">
      <div className="top-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="top-bar-title">{t("grades_title")}</div>
        <button
          type="button"
          aria-label={t("common_refresh")}
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="icon-button"
        >
          <AppIcon name="refresh" size={20} className={isRefreshing ? "spin" : ""} />
        </button>
      </div>

      <div className="container">
        <IntegrationErrorNotice error={error || refreshError} hasData={Boolean(data)} retry={() => void handleRefresh()} />
        {data ? <p className="personal-grade-help">{lang === "ru" ? "Нажми на оценку справа, чтобы добавить личную поправку." : lang === "uk" ? "Натисни на оцінку праворуч, щоб додати особисту поправку." : lang === "sk" ? "Klikni na známku vpravo pre osobnú úpravu." : "Click a grade on the right to add a personal correction."} {personalCopy[1]}</p> : null}
        <AcademicPeriodControls
          academicYearLabel={t("common_academic_year")}
          years={grades.academicYears}
          selectedStartYear={grades.selectedStartYear}
          onYearChange={(startYear) => {
            setRefreshError(null);
            setAcademicYearStart(startYear);
            window.localStorage.setItem("uniza:academic-year:v1", String(startYear));
          }}
          semester={semester}
          onSemesterChange={setSemester}
          winterLabel={t("grades_winter")}
          summerLabel={t("grades_summer")}
          winterCount={grades.winter.filter((grade) => grade.academicYearStart === grades.selectedStartYear).length}
          summerCount={grades.summer.filter((grade) => grade.academicYearStart === grades.selectedStartYear).length}
          disabled={loading || grades.academicYears.length === 0}
        />

        {loading ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "24px" }}>
              <div className="stat-card skeleton" style={{ height: "84px" }} />
              <div className="stat-card skeleton" style={{ height: "84px" }} />
              <div className="stat-card skeleton" style={{ height: "84px" }} />
            </div>
            <div className="card-group content">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="card-row skeleton" style={{ height: "72px" }} />
              ))}
            </div>
          </div>
        ) : error && !data ? null : (
          <div className="animate-slide-up">
            {currentYear.length > 0 ? (
              <>
                <div className="section-label grades-year-label">{t("grades_year_summary")}</div>
                <div className="grades-stats">
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--primary)", fontSize: "24px" }}>{earnedCredits}</div>
                    <div className="stat-label">{t("grades_year_credits")}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--success)", fontSize: "24px" }}>{avgGrade}</div>
                    <div className="stat-label">{t("grades_year_average")}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--warning)", fontSize: "24px" }}>{passedCount}/{currentYear.length}</div>
                    <div className="stat-label">{t("grades_year_completed")}</div>
                  </div>
                </div>
              </>
            ) : null}

            {current.length === 0 ? (
              <div className="empty-state">
                <AppIcon name="award" size={42} />
                <div className="card-title">{t("grades_no_data")}</div>
                <p className="text-sm">{t("grades_no_data_year")}</p>
              </div>
            ) : (
              <>
                {completed.length > 0 ? renderGradeRows(completed) : null}
                {pending.length > 0 ? (
                  <section className="pending-grades">
                    <div className="section-label">{t("grades_no_grade")} <span>{pending.length}</span></div>
                    {renderGradeRows(pending)}
                  </section>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
      {editing ? <dialog className="personal-grade-dialog" ref={(node) => { if (node && !node.open) node.showModal(); }} aria-labelledby="personal-grade-title" onCancel={() => setEditing(null)}>
        <h2 id="personal-grade-title">{personalCopy[0]}</h2><p>{editing.subject}</p><p className="text-sm">{personalCopy[1]}</p>
        <label>{personalCopy[2]}<select autoFocus value={draftGrade} onChange={(event) => setDraftGrade(event.target.value as PersonalGrade)}>{PERSONAL_GRADES.map((grade) => <option value={grade} key={grade}>{grade === "P" ? personalCopy[7] : grade}</option>)}</select></label>
        {editError ? <p role="alert">{personalCopy[6]}</p> : null}
        <div className="personal-grade-actions"><button type="button" onClick={() => savePersonalGrade(draftGrade)}>{personalCopy[3]}</button><button type="button" onClick={() => savePersonalGrade(null)}>{personalCopy[4]}</button><button type="button" onClick={() => setEditing(null)}>{personalCopy[5]}</button></div>
      </dialog> : null}
    </div>
  );
}
