import * as cheerio from "cheerio";

export type ParsedAivsSubject = {
  semester: "winter" | "summer";
  code: string;
  name: string;
  infoHref: string;
  moodleHref: string;
};

function normalizeSubjectName(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "";
}

export function parseAivsSubjects(html: string): {
  winter: ParsedAivsSubject[];
  summer: ParsedAivsSubject[];
} {
  const $ = cheerio.load(html);
  const subjects = new Map<string, ParsedAivsSubject>();
  let semester: "winter" | "summer" | null = null;

  $("#id-tabulka-predmety-s tr").each((_index, row) => {
    const directCells = $(row).children("td");
    if (!directCells.length || directCells.find("table").length) return;

    const separator = directCells.filter(".sep");
    if (separator.length) {
      const text = separator.text().trim().toLocaleLowerCase("sk");
      if (text.includes("zimný")) semester = "winter";
      else if (text.includes("letný")) semester = "summer";
      return;
    }

    if (!semester || directCells.filter(".hdr").length || $(row).hasClass("hdr")) return;

    const firstCell = directCells.first();
    const match = firstCell.text().replace(/\s+/g, " ").trim().match(/^(\S+)\s+(.+)$/);
    if (!match) return;

    const code = match[1];
    const name = normalizeSubjectName(match[2]);
    if (!code || !name) return;

    const infoHref = firstCell.find("a[href*='planinfo']").first().attr("href") || "";
    const moodleHref = $(row).find('a[target="tmoodle"]').first().attr("href") || "";
    const key = `${semester}:${code.toLocaleUpperCase("sk")}`;
    const existing = subjects.get(key);

    if (existing) {
      // AIVS can emit the same enrollment multiple times. Merge useful links
      // instead of rendering duplicate rows or discarding richer metadata.
      existing.infoHref ||= infoHref;
      existing.moodleHref ||= moodleHref;
      return;
    }

    subjects.set(key, { semester, code, name, infoHref, moodleHref });
  });

  const parsed = [...subjects.values()];
  return {
    winter: parsed.filter((subject) => subject.semester === "winter"),
    summer: parsed.filter((subject) => subject.semester === "summer"),
  };
}
