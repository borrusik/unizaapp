export type AivsGradeResult = {
  date: string;
  grade: string;
};

export function getAivsResultsTableYear(headerText: string): number | null {
  const match = headerText.match(/Akademick(?:ý|y)\s+rok\s+(\d{4})\s*\/\s*(\d{4})/i);
  if (!match) return null;

  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  return Number.isInteger(startYear) && endYear === startYear + 1
    ? startYear
    : null;
}

/**
 * AIVS stores exam grades in the second date/grade pair, while courses
 * completed by assessment (H) use the first pair labelled Zápočet / Zn.
 */
export function selectAivsGradeResult(
  completionType: string,
  creditDate: string,
  creditGrade: string,
  examDate: string,
  examGrade: string,
): AivsGradeResult {
  if (completionType.trim().toLocaleUpperCase("sk") === "H") {
    return {
      date: creditDate.trim(),
      grade: creditGrade.trim() || "—",
    };
  }

  return {
    date: examDate.trim(),
    grade: examGrade.trim() || "—",
  };
}
