import * as cheerio from "cheerio";

export type AivsResultTotals = { average: number | null; credits: number | null; points: number | null };
export type AivsYearResults = {
  startYear: number;
  label: string;
  total: AivsResultTotals;
  winter: AivsResultTotals;
  summer: AivsResultTotals;
};

/** Import the university's calculation, including its treatment of pending courses. */
export function parseAivsResultsSummary(html: string) {
  const $ = cheerio.load(html);
  const years = new Map<number, AivsYearResults>();
  const number = (value: string | undefined) => value === undefined ? null : Number(value.replace(",", "."));
  const metric = (text: string, label: string) => {
    const match = text.match(new RegExp(`${label}\\s*:\\s*(\\d+(?:[.,]\\d+)?)(?:\\s*\\(\\s*(\\d+(?:[.,]\\d+)?)\\s*\\/\\s*(\\d+(?:[.,]\\d+)?)\\s*\\))?`, "i"));
    return [number(match?.[1]), number(match?.[2]), number(match?.[3])];
  };
  $("table.data.tien").each((_index, table) => {
    const startYear = getAivsResultsTableYear($(table).prevAll("table:not(.data)").first().text());
    if (startYear === null) return;
    const footer = $(table).find("td.sep-mch").filter((_i, cell) => /Priemer\s*:/i.test($(cell).text())).last().text().replace(/\s+/g, " ");
    const average = metric(footer, "Priemer"), credits = metric(footer, "Súčet kreditov"), points = metric(footer, "Súčet bodov");
    const totals = (i: number): AivsResultTotals => ({ average: average[i], credits: credits[i], points: points[i] });
    years.set(startYear, { startYear, label: `${startYear}/${startYear + 1}`, total: totals(0), winter: totals(1), summer: totals(2) });
  });
  const text = $("body").text().replace(/\s+/g, " ");
  return {
    years: [...years.values()].sort((a, b) => b.startYear - a.startYear),
    total: {
      average: metric(text, "Celkový priemer")[0],
      credits: metric(text, "Celkový počet kreditov")[0],
      points: metric(text, "Celkový počet bodov")[0],
    } satisfies AivsResultTotals,
  };
}

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
