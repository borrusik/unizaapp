export type AcademicYearOption = {
  startYear: number;
  label: string;
};

export type AcademicYearSelection = {
  selectedStartYear: number | null;
  options: AcademicYearOption[];
};

export type Canteen = {
  id: number;
  name: string;
  code: string;
};

export type MenuItem = {
  id: string;
  date: string;
  canteenId: number;
  mealKindName: string;
  alternative: number | null;
  mealName: string;
  mealSize: string;
  price: string;
  allergens: string;
  note: string;
};

export type MenuDay = {
  date: string;
  groups: Array<{
    mealKindName: string;
    items: MenuItem[];
  }>;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function formatAcademicYear(startYear: number): string {
  return `${startYear}/${startYear + 1}`;
}

/**
 * AIVS uses Slovak dates (d.M.yyyy). UNIZA academic years start in September,
 * so January-August belong to the academic year that began the year before.
 */
export function getAcademicYearStartFromSlovakDate(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return month >= 9 ? year : year - 1;
}

export function parseAcademicYears(html: string): AcademicYearSelection {
  const options: AcademicYearOption[] = [];
  let selectedStartYear: number | null = null;
  const seen = new Set<number>();
  const optionPattern = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;

  for (const match of html.matchAll(optionPattern)) {
    const attributes = match[1] || "";
    const valueMatch = attributes.match(/\bvalue\s*=\s*["']?(\d{4})["']?/i);
    if (!valueMatch) continue;

    const startYear = Number(valueMatch[1]);
    if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2200) continue;

    const rawLabel = (match[2] || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const label = /^\d{4}\s*\/\s*\d{4}$/.test(rawLabel)
      ? rawLabel.replace(/\s+/g, "")
      : formatAcademicYear(startYear);

    if (!seen.has(startYear)) {
      seen.add(startYear);
      options.push({ startYear, label });
    }
    if (/\bselected\b/i.test(attributes)) selectedStartYear = startYear;
  }

  return {
    selectedStartYear: selectedStartYear ?? options[0]?.startYear ?? null,
    options,
  };
}

function getZonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Bratislava",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

export function getBratislavaDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = getZonedParts(date);
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

export function localDateToUtcIso(dateKey: string): string | null {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const guessParts = getZonedParts(new Date(utcGuess));
  const representedAsUtc = Date.UTC(
    guessParts.year,
    guessParts.month - 1,
    guessParts.day,
    guessParts.hour,
    guessParts.minute,
    guessParts.second,
  );
  const offset = representedAsUtc - utcGuess;
  return new Date(utcGuess - offset).toISOString();
}

export function listDateKeys(startDate: string, count: number): string[] {
  const match = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || count < 1 || count > 14) return [];
  const start = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Array.from({ length: count }, (_value, index) => {
    const date = new Date(start + index * 86_400_000);
    return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
  });
}

function normalizeAllergens(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(asString).filter(Boolean).join(", ");
  }
  return asString(value);
}

function formatPrice(item: UnknownRecord): string {
  const formatted = asString(item.priceWithCurrency);
  if (formatted && !/^0(?:[.,]0+)?\s*[^\d]*$/.test(formatted)) return formatted;

  const price = asNumber(item.price);
  const currency = asString(item.currency);
  if (price !== null && price > 0) {
    return `${price.toFixed(2).replace(".", ",")} ${currency || "€"}`.trim();
  }
  return "";
}

export function parseWebKreditMenu(payload: unknown): MenuDay[] {
  const containers = Array.isArray(payload) ? payload : [payload];
  const dayMap = new Map<string, Map<string, MenuItem[]>>();

  for (const containerValue of containers) {
    const container = asRecord(containerValue);
    if (!container) continue;
    const groups = Array.isArray(container.groups) ? container.groups : [];

    for (const groupValue of groups) {
      const group = asRecord(groupValue);
      if (!group) continue;
      const date = getBratislavaDateKey(asString(group.date));
      if (!date) continue;
      const mealKindName = asString(group.mealKindName) || "Menu";
      const rows = Array.isArray(group.rows) ? group.rows : [];
      const groupItems: MenuItem[] = [];

      for (const rowValue of rows) {
        const row = asRecord(rowValue);
        const item = asRecord(row?.item ?? rowValue);
        if (!item || item.show === false) continue;
        const mealName = asString(item.mealName) || asString(item.name);
        if (!mealName) continue;

        const canteenId = asNumber(item.canteenId) ?? 0;
        const alternative = asNumber(item.altId);
        const itemDate = getBratislavaDateKey(asString(item.date)) || date;
        const menuDetailId = asString(item.menuDetailId);
        const id = menuDetailId || [canteenId, itemDate, asNumber(item.mealKindId) ?? "meal", alternative ?? mealName].join("-");

        groupItems.push({
          id,
          date: itemDate,
          canteenId,
          mealKindName: asString(item.mealKindName) || mealKindName,
          alternative,
          mealName,
          mealSize: asString(item.mealSize),
          price: formatPrice(item),
          allergens: normalizeAllergens(item.allergens),
          note: asString(item.note),
        });
      }

      if (groupItems.length === 0) continue;
      const groupsForDay = dayMap.get(date) ?? new Map<string, MenuItem[]>();
      groupsForDay.set(mealKindName, [
        ...(groupsForDay.get(mealKindName) ?? []),
        ...groupItems,
      ]);
      dayMap.set(date, groupsForDay);
    }
  }

  return [...dayMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, groups]) => ({
      date,
      groups: [...groups.entries()].map(([mealKindName, items]) => ({ mealKindName, items })),
    }));
}

export function parseWebKreditCanteens(payload: unknown): {
  canteens: Canteen[];
  selectedCanteenId: number;
  message: string;
} {
  const data = asRecord(payload);
  const canteens = (Array.isArray(data?.canteens) ? data.canteens : [])
    .map(asRecord)
    .filter((item): item is UnknownRecord => Boolean(item))
    .map((item) => ({
      id: asNumber(item.id) ?? 0,
      name: asString(item.name),
      code: asString(item.code),
    }))
    .filter((item) => item.id > 0 && item.name);

  const requestedDefault = asNumber(data?.canteenId) ?? 1;
  return {
    canteens,
    selectedCanteenId: canteens.some((canteen) => canteen.id === requestedDefault)
      ? requestedDefault
      : canteens[0]?.id ?? 1,
    message: asString(data?.message),
  };
}
