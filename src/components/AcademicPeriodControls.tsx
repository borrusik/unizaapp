"use client";

import type { AcademicYearOption } from "@/lib/uniza-parsers";
import { AppIcon } from "@/components/AppIcon";

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
  hideSemester?: boolean;
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
  hideSemester = false,
}: AcademicPeriodControlsProps) {
  const winterShortLabel = winterLabel.split(/\s+/)[0];
  const summerShortLabel = summerLabel.split(/\s+/)[0];
  const semesterLabel = winterLabel.split(/\s+/).slice(1).join(" ");

  return (
    <section className="academic-period-controls" aria-label={academicYearLabel}>
      <div className="academic-period-heading">
        <span className="label">{academicYearLabel}</span>
      </div>

      <label className="academic-year-select">
        <select
          aria-label={academicYearLabel}
          value={selectedStartYear || ""}
          disabled={disabled}
          onChange={(event) => onYearChange(Number(event.target.value))}
        >
          {years.map((year) => (
            <option key={year.startYear} value={year.startYear}>{year.label}</option>
          ))}
        </select>
        <span aria-hidden="true"><AppIcon name="chevron-down" size={18} /></span>
      </label>

      {semesterLabel && (
        <div className="academic-period-heading semester-heading">
          <span className="label">{semesterLabel}</span>
        </div>
      )}

      {!hideSemester ? <div className={`semester-slider ${semester === "summer" ? "summer-active" : ""}`}>
        <span className="semester-slider-indicator" aria-hidden="true" />
        <button
          type="button"
          aria-label={winterLabel}
          aria-pressed={semester === "winter"}
          onClick={() => onSemesterChange("winter")}
        >
          <span className="semester-slider-label">{winterShortLabel}</span>
          <span className="semester-slider-count">{winterCount}</span>
        </button>
        <button
          type="button"
          aria-label={summerLabel}
          aria-pressed={semester === "summer"}
          onClick={() => onSemesterChange("summer")}
        >
          <span className="semester-slider-label">{summerShortLabel}</span>
          <span className="semester-slider-count">{summerCount}</span>
        </button>
      </div> : null}
    </section>
  );
}
