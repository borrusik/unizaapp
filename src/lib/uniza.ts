export const UNIZA_URLS = {
  education: "https://vzdelavanie.uniza.sk/vzdelavanie/",
  moodle: "https://vzdelavanie.uniza.sk/moodle/",
  catering: "https://strava.uniza.sk/WebKredit/",
  diningMenu: "https://menza.uniza.sk/jedalny-listok",
  academicCalendar: "https://www.uniza.sk/index.php/studenti/vseobecne-informacie/akademicky-kalendar",
  campus: "https://campus.uniza.sk/",
  helpdesk: "https://helpdesk.uniza.sk/",
} as const;

const AIVS_ORIGIN = new URL(UNIZA_URLS.education).origin;
const AIVS_BASE_URL = UNIZA_URLS.education;

function resolveOfficialAivsUrl(value: string): URL | null {
  try {
    const url = new URL(value, AIVS_BASE_URL);
    if (
      url.protocol !== "https:" ||
      url.origin !== AIVS_ORIGIN ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function resolveSubjectInfoUrl(value: string): string | null {
  const url = resolveOfficialAivsUrl(value);
  if (!url || !url.pathname.startsWith("/vzdelavanie/planinfo")) return null;
  return url.toString();
}

export function resolveMoodleUrl(value: string): string | null {
  const url = resolveOfficialAivsUrl(value);
  if (!url) return null;

  const isAllowedPath =
    url.pathname.startsWith("/moodle/") ||
    url.pathname.startsWith("/vzdelavanie/");

  return isAllowedPath ? url.toString() : null;
}

export function getAcademicYear(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Bratislava",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const startYear = month >= 9 ? year : year - 1;

  return `${startYear}/${startYear + 1}`;
}
