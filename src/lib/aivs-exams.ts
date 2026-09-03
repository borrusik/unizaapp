import * as cheerio from "cheerio";

export type ExamTerm = {
  id: string;
  academicYearStart: number;
  subject: string;
  subjectCode: string;
  date: string;
  time: string;
  room: string;
  teacher: string;
  capacity: number | null;
  occupied: number | null;
  type: string;
  note: string;
  deadline: string;
  canRegister: boolean;
  canCancel: boolean;
};

export type InternalExamTerm = ExamTerm & {
  actionHref: string;
  listHref: string;
};

function numberOrNull(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseAivsExamTerms(
  html: string,
  subject: string,
  subjectCode: string,
  academicYearStart: number,
  listHref: string,
): InternalExamTerm[] {
  const $ = cheerio.load(html);
  const terms = new Map<string, InternalExamTerm>();

  $("tr").each((_index, row) => {
    const cells = $(row).children("td");
    if (cells.length < 7) return;
    const dateAndTime = cells.eq(0).text().replace(/\s+/g, " ").trim();
    const match = dateAndTime.match(/^(\d{2})\.(\d{2})\.(\d{4})\s*\/\s*(\d{1,2}:\d{2})$/);
    if (!match) return;

    const actionCell = cells.eq(cells.length - 1);
    const infoHref = actionCell.find("a[href*='terminy_s.php?pid=']").last().attr("href") || "";
    const infoPid = (() => {
      try { return new URL(infoHref, "https://vzdelavanie.uniza.sk/vzdelavanie/").searchParams.get("pid") || ""; }
      catch { return ""; }
    })();
    const actionLink = actionCell.find("a").filter((_i, link) => {
      const title = $(link).find("img").attr("title") || $(link).attr("title") || "";
      return /Prihlásenie na termín|Odhlásenie z termínu/i.test(title);
    }).first();
    const actionTitle = actionLink.find("img").attr("title") || actionLink.attr("title") || "";
    const actionHref = actionLink.attr("href") || "";
    const directAction = /^terminy_s\.php\?pid=/i.test(actionHref);
    const deadlineMatch = actionHref.match(/Uzávierka termínu:\s*([^'";]+)/i);
    const date = `${match[3]}-${match[2]}-${match[1]}`;
    const id = infoPid || [academicYearStart, subjectCode, date, match[4], cells.eq(1).text().trim()].join("|");

    terms.set(id, {
      id,
      academicYearStart,
      subject,
      subjectCode,
      date,
      time: match[4].padStart(5, "0"),
      room: cells.eq(1).text().trim(),
      teacher: cells.eq(2).text().replace(/\s+/g, " ").trim(),
      capacity: numberOrNull(cells.eq(3).text()),
      occupied: numberOrNull(cells.eq(4).text()),
      type: cells.eq(5).text().replace(/\s+/g, " ").trim(),
      note: cells.eq(6).text().replace(/\s+/g, " ").trim(),
      deadline: deadlineMatch?.[1]?.trim() || "",
      canRegister: directAction && /Prihlásenie na termín/i.test(actionTitle),
      canCancel: directAction && /Odhlásenie z termínu/i.test(actionTitle),
      actionHref: directAction ? actionHref : "",
      listHref,
    });
  });

  return [...terms.values()].sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`));
}
