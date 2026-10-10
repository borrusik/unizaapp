// Inputs must belong to the same semester. Never join results across study years.
export function mergeStudyRows<S extends { code: string; name: string }, G extends { code: string; subject: string; academicYearStart: number | null }>(subjects: S[], grades: G[], year: number) {
  const code = (value: string) => value.trim().toUpperCase();
  const results = grades.filter((grade) => grade.academicYearStart === year);
  const subjectByCode = new Map(subjects.map((subject) => [code(subject.code), subject]));
  const resultCodes = new Set(results.map((grade) => code(grade.code)));
  return [
    ...results.map((grade) => ({ code: grade.code, name: grade.subject, grade, subject: subjectByCode.get(code(grade.code)) })),
    ...subjects.filter((subject) => !resultCodes.has(code(subject.code))).map((subject) => ({ code: subject.code, name: subject.name, grade: undefined, subject })),
  ];
}
