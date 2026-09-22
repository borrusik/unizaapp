export type InstagramMenuSection = {
  name: string;
  items: string[];
};

export type InstagramDailyMenu = {
  date: string;
  dayLabel: string;
  sections: InstagramMenuSection[];
  permalink: string;
};

const DATE_LINE = /^(Pondelok|Utorok|Streda|Štvrtok|Piatok|Sobota|Nedeľa)\s+(\d{1,2})\.(\d{1,2})\.(\d{4})$/i;
const SECTION_LINE = /^(Polievka(?:\s*[–-].*)?|Menu\s+[IVX]+(?:\s*[–-].*)?|Pizza\s+menu\s+[IVX]+(?:\s*[–-].*)?|Fit\s+menu(?:\s*[–-].*)?|Pult\s+FCC(?:\s+osmička)?(?:\s*[–-].*)?)$/i;

function dateKey(day: string, month: string, year: string) {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseInstagramMenuCaption(caption: string, permalink = ""): InstagramDailyMenu | null {
  const lines = caption
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const dateIndex = lines.findIndex((line) => DATE_LINE.test(line));
  if (dateIndex < 0) return null;
  const dateMatch = lines[dateIndex].match(DATE_LINE);
  if (!dateMatch) return null;

  const sections: InstagramMenuSection[] = [];
  let current: InstagramMenuSection | null = null;

  for (const line of lines.slice(dateIndex + 1)) {
    if (/^Prajeme\s+V[aá]m\s+dobr[uú]\s+chu[tť]/i.test(line) || line.startsWith("#")) break;
    if (/^DENN[ÉE]\s+MENU$/i.test(line)) continue;
    if (SECTION_LINE.test(line)) {
      current = { name: line, items: [] };
      sections.push(current);
      continue;
    }
    if (current) current.items.push(line);
  }

  const populated = sections.filter((section) => section.items.length > 0);
  if (populated.length === 0) return null;

  return {
    date: dateKey(dateMatch[2], dateMatch[3], dateMatch[4]),
    dayLabel: dateMatch[1],
    sections: populated,
    permalink,
  };
}
