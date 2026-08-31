"use client";

import type { AcademicYearOption } from "@/lib/uniza-parsers";

type Semester = "winter" | "summer";

type AcademicPeriodControlsProps = {
  academicYearLabel: string;
  years: AcademicYearOption[];
  selectedStartYear: number;
  onYearChange: (startYear: number) => void;
  semester: Semester;
  onSemesterChange: (semester: Semester) => void;
  winterLabel: string;
  summerLabel: string;
  winterCount: number;
  summerCount: number;
  disabled?: boolean;
};

export function AcademicPeriodControls({
  academicYearLabel,
  years,
  selectedStartYear,
  onYearChange,
  semester,
  onSemesterChange,
  winterLabel,
  summerLabel,
  winterCount,
  summerCount,
  disabled = false,
}: AcademicPeriodControlsProps) {
  const selectedLabel = years.find((year) => year.startYear === selectedStartYear)?.label;
  const winterShortLabel = winterLabel.split(/\s+/)[0];
  const summerShortLabel = summerLabel.split(/\s+/)[0];

  return (
    <section className="academic-period-controls" aria-label={academicYearLabel}>
      <div className="academic-period-heading">
        <span className="label">{academicYearLabel}</span>
        {selectedLabel && <span className="academic-period-current">{selectedLabel}</span>}
      </div>

      <div className="academic-year-scroll" role="group" aria-label={academicYearLabel}>
        {years.map((year) => {
          const active = year.startYear === selectedStartYear;
          return (
            <button
              key={year.startYear}
              type="button"
              className={`academic-year-chip ${active ? "active" : ""}`}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onYearChange(year.startYear)}
            >
              <span>{year.startYear}</span>
              <span className="academic-year-chip-end">/{year.startYear + 1}</span>
            </button>
          );
        })}
      </div>

      <div className={`semester-slider ${semester === "summer" ? "summer-active" : ""}`}>
        <span className="semester-slider-indicator" aria-hidden="true" />
        <button
          type="button"
          aria-label={winterLabel}
          aria-pressed={semester === "winter"}
          onClick={() => onSemesterChange("winter")}
        >
          <span aria-hidden="true">❄️</span>
          <span className="semester-slider-label">{winterShortLabel}</span>
          <span className="semester-slider-count">{winterCount}</span>
        </button>
        <button
          type="button"
          aria-label={summerLabel}
          aria-pressed={semester === "summer"}
          onClick={() => onSemesterChange("summer")}
        >
          <span aria-hidden="true">☀️</span>
          <span className="semester-slider-label">{summerShortLabel}</span>
          <span className="semester-slider-count">{summerCount}</span>
        </button>
      </div>
    </section>
  );
}
