"use client";

import { useState } from "react";
import { getGrades, getSubjects } from "@/lib/scraper";
import Link from "next/link";
import { mergeStudyRows } from "@/lib/study";
import { isPassedGrade } from "@/lib/grade-overrides";
import type { Grade } from "@/lib/scraper";
import { useTranslation } from "@/hooks/useTranslation";
import { AcademicPeriodControls } from "@/components/AcademicPeriodControls";
import { AppIcon } from "@/components/AppIcon";
import useSWR from "swr";
import { IntegrationErrorNotice } from "@/components/IntegrationErrorNotice";
import { useGradeOverrides } from "@/hooks/useGradeOverrides";
import { applyGradeOverrides, displayedGradeSummary, PERSONAL_GRADES, type PersonalGrade } from "@/lib/grade-overrides";
import { GradeAverageLabel } from "@/components/GradeAverageLabel";

export default function StudyPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
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
  const subjectsRequest = useSWR(["uniza_subjects", academicYearStart ?? "current"], () => getSubjects(academicYearStart), { dedupingInterval: 300000, revalidateOnFocus: false });
  const studyCopy = {
    ru: ["Поиск предмета", "Все", "Без итоговой оценки", "Закрытые", "Подробнее", "Нет совпадений", "Оценка ещё не получена", "Результаты пока недоступны"],
    uk: ["Пошук предмета", "Усі", "Без підсумкової оцінки", "Зараховані", "Докладніше", "Немає збігів", "Оцінку ще не отримано", "Результати поки недоступні"],
    sk: ["Hľadať predmet", "Všetky", "Bez známky", "Absolvované", "Podrobnosti", "Žiadne výsledky", "Zatiaľ bez známky", "Výsledky zatiaľ nie sú dostupné"],
    en: ["Search subjects", "All", "No final grade", "Passed", "Details", "No matches", "No final grade yet", "Results unavailable"],
  }[lang];

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const outcomes = await Promise.allSettled([
        mutate(() => getGrades(academicYearStart, true), { revalidate: false }),
        subjectsRequest.mutate(() => getSubjects(academicYearStart, true), { revalidate: false }),
      ]);
      const failed = outcomes.find((outcome) => outcome.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
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
  const period = data || subjectsRequest.data || grades;
  const matchingSubjects = subjectsRequest.data?.selectedStartYear === period.selectedStartYear ? subjectsRequest.data[semester] : [];
  const rows = mergeStudyRows(matchingSubjects, current, period.selectedStartYear).filter((row) => {
    const matches = `${row.name} ${row.code}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    return matches && (filter === "all" || (filter === "passed" ? Boolean(row.grade && isPassedGrade(row.grade.grade)) : Boolean(row.grade && (!row.grade.grade || row.grade.grade === "—"))));
  });

  const gradeClassMap: Record<string, string> = {
    A: "badge-a", B: "badge-b", C: "badge-c", D: "badge-d", E: "badge-e", FX: "badge-fx",
  };

  const gradeColorMap: Record<string, string> = {
    A: "var(--success)", B: "#5ac8fa", C: "var(--warning)", D: "var(--purple)", E: "var(--orange)", FX: "var(--danger)",
  };

  const officialYear = data?.official.years.find((year) => year.startYear === grades.selectedStartYear);
  const officialSemester = officialYear?.[semester];
  const { credits: earnedCredits, average: avgGrade, passed: passedCount, source: averageSource } = displayedGradeSummary(currentYear, officialYear?.total);
  const resultsCopy = {
    ru: ["Баллы за семестр", "Итоги AIVS за семестр", "Средний", "Баллы", "В среднем AIVS незакрытые предметы учитываются как FX. Личные поправки не меняют официальные результаты.", "Открыть результаты в AIVS", "Официальный средний за год"],
    uk: ["Бали за семестр", "Підсумки AIVS за семестр", "Середній", "Бали", "У середньому AIVS незакриті предмети враховуються як FX. Особисті поправки не змінюють офіційні результати.", "Відкрити результати в AIVS", "Офіційний середній за рік"],
    sk: ["Body za semester", "Výsledky AIVS za semester", "Priemer", "Body", "AIVS počíta nesplnené predmety ako FX. Osobné úpravy nemenia oficiálne výsledky.", "Otvoriť výsledky v AIVS", "Oficiálny ročný priemer"],
    en: ["Semester points", "AIVS semester results", "Average", "Points", "AIVS counts unfinished courses as FX. Personal corrections do not change official results.", "Open results in AIVS", "Official annual average"],
  }[lang];
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
              {item.semesterPoints ? <small className="text-xs">{resultsCopy[0]}: {item.semesterPoints}</small> : null}
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
    <div className="dashboard-page dashboard-page-standard study-compact">
      <div className="top-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="top-bar-title">{t("nav_study")}</div>
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
        <IntegrationErrorNotice error={subjectsRequest.error} hasData={Boolean(subjectsRequest.data)} retry={() => void handleRefresh()} />
        <AcademicPeriodControls
          academicYearLabel={t("common_academic_year")}
          years={period.academicYears}
          selectedStartYear={period.selectedStartYear}
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
          disabled={period.academicYears.length === 0}
        />

        {loading && !subjectsRequest.data ? (
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
        ) : error && !data && !subjectsRequest.data ? null : (
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
                    <div className="stat-label"><GradeAverageLabel source={averageSource} /></div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--warning)", fontSize: "24px" }}>{passedCount}/{currentYear.length}</div>
                    <div className="stat-label">{t("grades_year_completed")}</div>
                  </div>
                </div>
                <details className="study-results-details">
                  <summary>{lang === "ru" ? "Семестр и расчёт показателей" : lang === "uk" ? "Семестр і розрахунок показників" : lang === "sk" ? "Semester a výpočet výsledkov" : "Semester and calculation details"}</summary>
                  {officialSemester ? <>
                  <strong>{resultsCopy[1]}</strong>
                  <p>{resultsCopy[2]}: {officialSemester.average?.toFixed(2) ?? "—"} · ECTS: {officialSemester.credits ?? "—"} · {resultsCopy[3]}: {officialSemester.points ?? "—"}</p>
                  {averageSource === "personal" ? <p>{resultsCopy[6]}: {officialYear?.total.average?.toFixed(2) ?? "—"}</p> : null}
                  <p>{resultsCopy[4]}</p>
                  <a href="https://vzdelavanie.uniza.sk/vzdelavanie/svysledky.php" target="_blank" rel="noopener noreferrer">{resultsCopy[5]}</a>
                  </> : null}
                  <p>{lang === "ru" ? "Нажми на оценку предмета, чтобы добавить личную поправку." : lang === "uk" ? "Натисни на оцінку предмета, щоб додати особисту поправку." : lang === "sk" ? "Klikni na známku predmetu pre osobnú úpravu." : "Click a subject grade to add a personal correction."} {personalCopy[1]}</p>
                </details>
              </>
            ) : null}

            <div className="study-tools">
              <input type="search" aria-label={studyCopy[0]} placeholder={studyCopy[0]} value={query} onChange={(event) => setQuery(event.target.value)} />
              <div className="study-filters">{["all", "pending", "passed"].map((value, index) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{studyCopy[index + 1]}</button>)}</div>
            </div>
            {rows.length === 0 ? (
              <div className="empty-state">
                <AppIcon name="award" size={42} />
                <div className="card-title">{query || filter !== "all" ? studyCopy[5] : t("subjects_no_data")}</div>
              </div>
            ) : (
              <div className="study-list">{rows.map((row, index) => <article className="study-row" key={`${period.selectedStartYear}-${semester}-${row.code}-${index}`}>
                {row.grade ? renderGradeRows([row.grade]) : <div className="card-row"><div><div className="card-title">{row.name}</div><div className="text-xs">{row.code} · {studyCopy[7]}</div></div></div>}
                <div className="study-actions">
                  {row.grade && (!row.grade.grade || row.grade.grade === "—") ? <span className="text-xs">{studyCopy[6]}</span> : null}
                  {row.subject?.moodleUrl ? <a href={row.subject.moodleUrl} target="_blank" rel="noopener noreferrer" className="study-action">Moodle <AppIcon name="external-link" size={14} /></a> : null}
                  {row.subject?.infoUrl ? <Link prefetch={false} href={`/dashboard/subject?url=${encodeURIComponent(row.subject.infoUrl)}&name=${encodeURIComponent(row.name)}`} className="study-action">{studyCopy[4]}</Link> : null}
                </div>
              </article>)}</div>
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
