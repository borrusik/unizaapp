import * as cheerio from "cheerio";

const FACULTY_STOP = /\s+(?:Akad(?:emick|\.)|Štud|Miest|Predmet|Zimn|Letn|\d{4}\s*\/)/i;

export function parseAivsFaculty(html: string): string {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const label = text.match(/(?:^|\s)Fakulta:\s*/i);
  if (!label || label.index === undefined) return "";

  const afterLabel = text.slice(label.index + label[0].length);
  const stop = afterLabel.search(FACULTY_STOP);
  const faculty = (stop >= 0 ? afterLabel.slice(0, stop) : afterLabel)
    .replace(/\s+/g, " ")
    .trim();

  if (faculty.length < 3 || faculty.length > 120) return "";
  if (!/(?:fakulta|ústav)/i.test(faculty)) return "";
  return faculty;
}
