export const PERSONAL_GRADES = ["A", "B", "C", "D", "E", "FX", "P", "—"] as const;
export type PersonalGrade = typeof PERSONAL_GRADES[number];
export type GradeIdentity = { code: string; academicYearStart: number | null; type: string; grade: string; credits: number };
export type GradeOverrides = Record<string, PersonalGrade>;

export function gradeOverrideKey(item: GradeIdentity): string {
  return JSON.stringify([item.academicYearStart, item.code.trim().toUpperCase(), item.type]);
}

export function parseGradeOverrides(raw: string): GradeOverrides {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, grade]) =>
      key.length < 250 && PERSONAL_GRADES.includes(grade as PersonalGrade),
    )) as GradeOverrides;
  } catch { return {}; }
}

export function applyGradeOverrides<T extends GradeIdentity>(items: T[], overrides: GradeOverrides) {
  return items.map((item) => {
    const grade = overrides[gradeOverrideKey(item)];
    return { ...item, originalGrade: item.grade, localOverride: grade !== undefined, grade: grade ?? item.grade };
  });
}

export function isPassedGrade(grade: string): boolean {
  return ["A", "B", "C", "D", "E", "P"].includes(grade.trim().toUpperCase());
}

export function gradeSummary(items: GradeIdentity[]) {
  const values: Record<string, number> = { A: 1, B: 1.5, C: 2, D: 2.5, E: 3, FX: 4 };
  let credits = 0, passed = 0, weighted = 0, scoredCredits = 0;
  for (const item of items) {
    if (isPassedGrade(item.grade)) { credits += item.credits; passed++; }
    if (values[item.grade] !== undefined) {
      weighted += values[item.grade] * item.credits;
      scoredCredits += item.credits;
    }
  }
  return { credits, passed, average: scoredCredits ? (weighted / scoredCredits).toFixed(2) : "—" };
}

export function displayedGradeSummary(
  items: (GradeIdentity & { localOverride?: boolean })[],
  official?: { average: number | null; credits: number | null },
) {
  const calculated = gradeSummary(items);
  const personal = items.some((item) => item.localOverride);
  const officialAverage = !personal && official?.average != null;
  return {
    ...calculated,
    credits: !personal && official?.credits != null ? official.credits : calculated.credits,
    average: officialAverage ? official.average!.toFixed(2) : calculated.average,
    source: officialAverage ? "aivs" as const : personal ? "personal" as const : "graded" as const,
  };
}
