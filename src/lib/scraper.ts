"use server";

import { cookies } from "next/headers";
import * as cheerio from "cheerio";
import { rateLimit } from "@/lib/rate-limit";
import { authenticateStrava, clearStravaSession, getStoredStravaSession, storeStravaSession } from "@/lib/strava-session";
import { getAcademicYear, resolveExamTermsUrl, resolveMoodleUrl, resolveSubjectInfoUrl } from "@/lib/uniza";
import {
  formatAcademicYear,
  getAcademicYearStartFromSlovakDate,
  parseAcademicYears,
  type AcademicYearOption,
  type AcademicYearSelection,
  type IntegrationOperationResult,
} from "@/lib/uniza-parsers";
import { canPersistCredentials, clearCredentials, readCredentials, saveCredentials } from "@/lib/credentials";
import { parseAivsSubjects } from "@/lib/aivs-subjects";
import { parseAivsExamTerms, type ExamTerm, type InternalExamTerm } from "@/lib/aivs-exams";
import { parseAivsFaculty } from "@/lib/aivs-profile";
import { getAivsScheduleSourceState } from "@/lib/aivs-schedule";
import { getAivsResultsTableYear, selectAivsGradeResult } from "@/lib/aivs-grades";

const BASE_URL = "https://vzdelavanie.uniza.sk/vzdelavanie";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const examOperationLocks = new Map<string, number>();

// ─────────────────────────────────────────────
// Fetch with Windows-1250 decoding
// ─────────────────────────────────────────────

async function fetchDecoded(url: string, options?: RequestInit): Promise<string> {
  const res = await fetch(url, {
    ...options,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`UNIZA request failed with status ${res.status}`);

  const declaredLength = Number(res.headers.get("content-length") || 0);
  if (declaredLength > MAX_HTML_BYTES) throw new Error("UNIZA response is too large");

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_HTML_BYTES) throw new Error("UNIZA response is too large");
  const decoder = new TextDecoder("windows-1250");
  return decoder.decode(buffer);
}

// ─────────────────────────────────────────────
// Session Management
// ─────────────────────────────────────────────

async function getPhpSession(email: string, password: string): Promise<string | null> {
  // Step 1: Get initial PHPSESSID
  const loginPageRes = await fetch(`${BASE_URL}/login.php`, {
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const rawCookies = loginPageRes.headers.get("set-cookie") || "";
  const match = rawCookies.match(/PHPSESSID=([^;]+)/);
  const phpSessionId = match ? match[1] : "";

  if (!phpSessionId) return null;

  // Step 2: POST login
  const formBody = new URLSearchParams({
    meno: email,
    heslo: password,
    login: "Prihlásenie",
  });

  await fetch(`${BASE_URL}/login.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: `PHPSESSID=${phpSessionId}`,
    },
    body: formBody.toString(),
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  // Step 3: Verify the session and warm the currently selected academic year.
  const academicYears = await getAcademicYearOptions().catch(() => null);
  const selectedStartYear = academicYears?.selectedStartYear ??
    academicYears?.options[0]?.startYear ??
    Number(getAcademicYear().split("/")[0]);
  const yearQuery = selectedStartYear ? `?ra=${selectedStartYear}` : "";
  const requestOptions = {
    headers: { Cookie: `PHPSESSID=${phpSessionId}` },
    redirect: "manual" as const,
  };
  const testHtml = await fetchDecoded(
    `${BASE_URL}/predmety_s.php${yearQuery}`,
    requestOptions,
  );

  if (testHtml.includes('name="heslo"')) {
    return null; // Still on login page — auth failed
  }

  // Inject pre-fetched results directly into PAGE_CACHE
  const now = Date.now();
  if (PAGE_CACHE.size > 500) PAGE_CACHE.clear();
  PAGE_CACHE.set(`${phpSessionId}_predmety_s.php${yearQuery}`, { html: testHtml, timestamp: now });

  // Optional pages improve the first load, but a temporary failure in grades,
  // schedule, profile, or plans must not invalidate an otherwise valid login.
  const warmPages = ["svysledky.php", "rozvrh2.php", "index.php", "plany.php"];
  const warmed = await Promise.allSettled(
    warmPages.map((page) => fetchDecoded(`${BASE_URL}/${page}${yearQuery}`, requestOptions)),
  );
  warmed.forEach((result, index) => {
    if (result.status === "fulfilled") {
      PAGE_CACHE.set(`${phpSessionId}_${warmPages[index]}${yearQuery}`, {
        html: result.value,
        timestamp: now,
      });
    }
  });

  return phpSessionId;
}

const PAGE_CACHE = new Map<string, { html: string; timestamp: number }>();
const PAGE_REQUESTS = new Map<string, Promise<string>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const sessionRefreshRequests = new Map<string, Promise<string | null>>();

function clearSessionCaches(sessionId: string | undefined) {
  if (!sessionId) return;
  for (const key of PAGE_CACHE.keys()) {
    if (key.startsWith(`${sessionId}_`)) PAGE_CACHE.delete(key);
  }
  studyYearsCache.delete(sessionId);
  studyYearsRequests.delete(sessionId);
  sessionRefreshRequests.delete(sessionId);
}

async function restoreExpiredSession(sessionId: string): Promise<string | null> {
  const pending = sessionRefreshRequests.get(sessionId);
  if (pending) return pending;

  const request = (async () => {
    const credentials = await readCredentials();
    if (!credentials) return null;
    return getPhpSession(credentials.email, credentials.password);
  })();
  if (sessionRefreshRequests.size > 500) sessionRefreshRequests.clear();
  sessionRefreshRequests.set(sessionId, request);
  return request;
}

async function fetchPage(sessionId: string, page: string, force = false): Promise<string> {
  const cacheKey = `${sessionId}_${page}`;

  if (!force && PAGE_CACHE.has(cacheKey)) {
    const cached = PAGE_CACHE.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.html;
    }
  }

  const requestKey = `${cacheKey}_${force ? "refresh" : "normal"}`;
  const pending = PAGE_REQUESTS.get(requestKey);
  if (pending) return pending;

  const request = (async () => {
    let html = await fetchDecoded(`${BASE_URL}/${page}`, {
      headers: { Cookie: `PHPSESSID=${sessionId}` },
    });

    // Restore an expired upstream session from the encrypted credential cookie when configured.
    if (html.includes('name="heslo"') || html.includes('<title>Prihlásenie</title>')) {
      const cookieStore = await cookies();
      const newSessionId = await restoreExpiredSession(sessionId);
      if (newSessionId) {
        cookieStore.set("uniza_phpsessid", newSessionId, {
          httpOnly: true,
          path: "/",
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        });
        html = await fetchDecoded(`${BASE_URL}/${page}`, {
          headers: { Cookie: `PHPSESSID=${newSessionId}` },
        });
        PAGE_CACHE.set(`${newSessionId}_${page}`, { html, timestamp: Date.now() });
        return html;
      }

      cookieStore.delete("uniza_phpsessid");
      await clearStravaSession();
      return "";
    } else {
      // Prevent memory leaks
      if (PAGE_CACHE.size > 500) PAGE_CACHE.clear();
      PAGE_CACHE.set(cacheKey, { html, timestamp: Date.now() });
    }

    return html;
  })();

  if (PAGE_REQUESTS.size > 500) PAGE_REQUESTS.clear();
  PAGE_REQUESTS.set(requestKey, request);
  try {
    return await request;
  } finally {
    if (PAGE_REQUESTS.get(requestKey) === request) PAGE_REQUESTS.delete(requestKey);
  }
}

const ACADEMIC_YEAR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let academicYearCache: { data: AcademicYearSelection; timestamp: number } | null = null;

export async function getAcademicYearOptions(force = false): Promise<AcademicYearSelection> {
  if (
    !force &&
    academicYearCache &&
    Date.now() - academicYearCache.timestamp < ACADEMIC_YEAR_CACHE_TTL_MS
  ) {
    return academicYearCache.data;
  }

  try {
    const html = await fetchDecoded(`${BASE_URL}/login.php`);
    const parsed = parseAcademicYears(html);
    if (parsed.options.length > 0) {
      academicYearCache = { data: parsed, timestamp: Date.now() };
      return parsed;
    }
  } catch (error) {
    console.error("Failed to load AIVS academic years:", error);
  }

  const fallbackStartYear = Number(getAcademicYear().split("/")[0]);
  return {
    selectedStartYear: fallbackStartYear,
    options: [{
      startYear: fallbackStartYear,
      label: formatAcademicYear(fallbackStartYear),
    }],
  };
}

async function resolveAcademicYear(requestedStartYear?: number) {
  const selection = await getAcademicYearOptions();
  const requested = Number(requestedStartYear);
  const selectedStartYear = Number.isInteger(requested) &&
    selection.options.some((option) => option.startYear === requested)
    ? requested
    : selection.selectedStartYear ?? selection.options[0].startYear;

  return {
    selectedStartYear,
    academicYear: formatAcademicYear(selectedStartYear),
    academicYears: selection.options,
  };
}

const STUDY_YEARS_CACHE_TTL_MS = 30 * 60 * 1000;
const studyYearsCache = new Map<string, { data: AcademicYearOption[]; timestamp: number }>();
const studyYearsRequests = new Map<string, Promise<AcademicYearOption[]>>();

async function getStudyAcademicYears(
  sessionId: string,
  force = false,
): Promise<AcademicYearOption[]> {
  const selection = await getAcademicYearOptions(force);
  const cached = studyYearsCache.get(sessionId);
  if (!force && cached && Date.now() - cached.timestamp < STUDY_YEARS_CACHE_TTL_MS) {
    return cached.data;
  }

  if (!force && studyYearsRequests.has(sessionId)) {
    return studyYearsRequests.get(sessionId)!;
  }

  const request = (async () => {
    const available: AcademicYearOption[] = [];
    let foundStudyYear = false;
    const ordered = selection.options.toSorted((left, right) => right.startYear - left.startYear);

    // Most students only need the current and one or two previous years.
    // Probe in small parallel batches and stop after the first empty year below
    // their study range instead of requesting the entire AIVS archive.
    for (let index = 0; index < ordered.length; index += 3) {
      const batch = ordered.slice(index, index + 3);
      const results = await Promise.all(batch.map(async (year) => {
        const html = await fetchPage(sessionId, `predmety_s.php?ra=${year.startYear}`, force);
        const parsed = parseAivsSubjects(html);
        return { year, hasSubjects: parsed.winter.length + parsed.summer.length > 0 };
      }));

      const yearsWithSubjects = results.filter((result) => result.hasSubjects);
      if (yearsWithSubjects.length > 0) foundStudyYear = true;
      available.push(...yearsWithSubjects.map((result) => result.year));
      if (foundStudyYear && results.at(-1)?.hasSubjects === false) break;
    }

    const fallback = selection.options.find(
      (year) => year.startYear === selection.selectedStartYear,
    ) ?? selection.options[0];
    const data = available.length > 0 ? available : fallback ? [fallback] : [];
    if (studyYearsCache.size > 500) studyYearsCache.clear();
    studyYearsCache.set(sessionId, { data, timestamp: Date.now() });
    return data;
  })();

  studyYearsRequests.set(sessionId, request);
  try {
    return await request;
  } finally {
    studyYearsRequests.delete(sessionId);
  }
}

async function resolveStudyAcademicYear(
  sessionId: string,
  requestedStartYear?: number,
  force = false,
): Promise<AcademicPeriodData> {
  const publicSelection = await getAcademicYearOptions(force);
  const academicYears = await getStudyAcademicYears(sessionId, force);
  const requested = Number(requestedStartYear);
  const preferred = publicSelection.selectedStartYear;
  const selectedStartYear = Number.isInteger(requested) &&
    academicYears.some((year) => year.startYear === requested)
    ? requested
    : academicYears.find((year) => year.startYear === preferred)?.startYear ??
      academicYears[0]?.startYear ??
      preferred ??
      Number(getAcademicYear().split("/")[0]);

  return {
    selectedStartYear,
    academicYear: formatAcademicYear(selectedStartYear),
    academicYears,
  };
}

// ─────────────────────────────────────────────
// Auth Actions
// ─────────────────────────────────────────────

export async function login(formData: FormData) {
  const email = formData.get("email")?.toString()?.trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const remember = formData.getAll("remember").some((value) => value === "on");

  if (!email || !password) {
    return { error: "Zadajte email a heslo" };
  }

  // Input validation: email format
  if (email.length > 100 || password.length > 200) {
    return { error: "Neplatné údaje" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Neplatný formát emailu" };
  }

  // Rate limit login by email (5 attempts per 2 minutes)
  const { limited } = rateLimit(`login_${email}`, 5, 2 * 60 * 1000);
  if (limited) {
    return { error: "Príliš veľa pokusov. Skúste znova o 2 minúty." };
  }

  const cookieStore = await cookies();
  clearSessionCaches(cookieStore.get("uniza_phpsessid")?.value);
  cookieStore.delete("uniza_phpsessid");
  cookieStore.delete("uniza_email");
  await clearCredentials();
  await clearStravaSession();

  let sessionId: string | null;
  let stravaSession: Awaited<ReturnType<typeof authenticateStrava>> | null;
  try {
    [sessionId, stravaSession] = await Promise.all([
      getPhpSession(email, password),
      authenticateStrava(email.split("@")[0], password).catch(() => null),
    ]);
  } catch {
    return { error: "Systém UNIZA je dočasne nedostupný. Skúste to znova." };
  }
  if (!sessionId) {
    return { error: "Nesprávne prihlasovacie údaje" };
  }

  cookieStore.set("uniza_phpsessid", sessionId, {
    httpOnly: true, path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  cookieStore.set("uniza_email", email, {
    httpOnly: true, path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  const cateringConnected = await storeStravaSession(stravaSession);
  const credentialsStored = remember ? await saveCredentials({ email, password }) : false;

  return {
    success: true,
    integrations: { education: true, catering: cateringConnected },
    credentialsStored,
  };
}

export async function logout() {
  const cookieStore = await cookies();
  clearSessionCaches(cookieStore.get("uniza_phpsessid")?.value);
  cookieStore.delete("uniza_phpsessid");
  cookieStore.delete("uniza_email");
  await clearCredentials();
  await clearStravaSession();
  return { success: true };
}

export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("uniza_phpsessid")?.value;
  if (sessionId) return sessionId;

  const credentials = await readCredentials();
  if (!credentials) return null;

  const restoredSessionId = await getPhpSession(credentials.email, credentials.password);
  if (!restoredSessionId) {
    await clearCredentials();
    return null;
  }

  cookieStore.set("uniza_phpsessid", restoredSessionId, {
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  return restoredSessionId;
}

export async function getIntegrationStatus() {
  const cookieStore = await cookies();
  const cateringSession = await getStoredStravaSession();

  return {
    education: Boolean(cookieStore.get("uniza_phpsessid")?.value),
    catering: Boolean(cateringSession),
    passwordStored: canPersistCredentials() && Boolean(await readCredentials()),
  };
}

// ─────────────────────────────────────────────
// Data Types
// ─────────────────────────────────────────────

export type Subject = {
  id: string;
  code: string;
  name: string;
  hasMoodle: boolean;
  moodleUrl: string;
  infoUrl: string;
};

export type Grade = {
  subject: string;
  code: string;
  grade: string;
  credits: number;
  date: string;
  type: string;
  points: string;
  academicYearStart: number | null;
};

export type ScheduleItem = {
  id: string;
  day: string;
  dayShort: string;
  timeStart: string;
  timeEnd: string;
  room: string;
  subject: string;
  type: "lecture" | "exercise" | "lab";
  color: string;
  teacher: string;
  timeInfo?: string;
};

export type ScheduleData = {
  items: ScheduleItem[];
  status: "ready" | "empty" | "unavailable" | "unauthenticated" | "error";
};

export type AcademicPeriodData = {
  selectedStartYear: number;
  academicYear: string;
  academicYears: AcademicYearOption[];
};

// ─────────────────────────────────────────────
export async function getUserInfo(
  explicitSessionId?: string,
  explicitEmail?: string,
  force = false,
) {
  const cookieStore = await cookies();
  const email = explicitEmail || cookieStore.get("uniza_email")?.value || "student@stud.uniza.sk";

  // Default values
  let name = email.split("@")[0];
  name = name.charAt(0).toUpperCase() + name.slice(1);
  let group = "Neznáma";
  let personalNumber = "Neznáme";
  let faculty = "Žilinská univerzita v Žiline";
  let program = "Neznámy program";

  const year = await resolveAcademicYear();
  const yearQuery = `?ra=${year.selectedStartYear}`;
  const sessionId = explicitSessionId || await getSession();
  if (sessionId) {
    try {
      const [indexHtml, svysledkyHtml, predmetyHtml] = await Promise.all([
        fetchPage(sessionId, `index.php${yearQuery}`, force),
        fetchPage(sessionId, `svysledky.php${yearQuery}`, force),
        fetchPage(sessionId, `predmety_s.php${yearQuery}`, force),
      ]);

      // Extract group from indexHtml
      const groupMatch = indexHtml.match(/id="desk-menu-lng38"[^>]*>Študijná skupina:\s*<\/span>\s*([^<]+)<\/span>/i);
      if (groupMatch && groupMatch[1]) group = groupMatch[1].trim();

      const numberMatch = indexHtml.match(/id="desk-menu-lng39"[^>]*>Osobné číslo:\s*<\/span>\s*([^<]+)<\/span>/i);
      if (numberMatch && numberMatch[1]) personalNumber = numberMatch[1].trim();

      // Better name parsing from the profile page header
      const nameMatch = indexHtml.match(/id="mch-name-desk"[^>]*>\s*([^<]+)<\/b>/i);
      if (nameMatch && nameMatch[1]) {
        // Title case the name
        name = nameMatch[1].trim().toLowerCase().split(' ').map((s: string) => s.charAt(0).toUpperCase() + s.substring(1)).join(' ');
      }

      // Parse Faculty from predmetyHtml (e.g. "Fakulta: Fakulta riadenia a informatiky")
      faculty = parseAivsFaculty(predmetyHtml) || faculty;

      // Parse Program (odbor) from svysledkyHtml 
      // Look for format like: "Akademický rok 2025 / 2026 5ZYI14 - informatika"
      const $svys = cheerio.load(svysledkyHtml);
      const svysText = $svys("body").text().replace(/\s+/g, ' ');
      // Search for group + "-" + program, stopping right before "Predmet" or "Tabuľka"
      if (group !== "Neznáma") {
        const progRegex = new RegExp(`${group}\\s*-\\s*(.+?)\\s*(?:Predmet|Akad|\\|)`, 'i');
        const pProgram = svysText.match(progRegex);
        if (pProgram && pProgram[1]) {
          let rawProg = pProgram[1].trim();
          rawProg = rawProg.charAt(0).toUpperCase() + rawProg.slice(1);
          program = rawProg;
        }
      }

    } catch (e) {
      console.error("Error fetching user info details:", e);
    }
  }

  // Fallback to group guessing if we failed to parse anything useful
  if (faculty === "Žilinská univerzita v Žiline") {
    if (group.toUpperCase().includes("ZYI") || group.toUpperCase().includes("ZI")) {
      faculty = "Fakulta riadenia a informatiky (FRI)";
    }
  }

  if (program === "Neznámy program") {
    if (group.toUpperCase().includes("ZYI") || group.toUpperCase().includes("ZI")) {
      program = "Informatika / Manažment";
    }
  }

  return {
    name,
    email,
    faculty,
    program,
    group,
    personalNumber,
    academicYear: year.academicYear,
  };
}

// ─────────────────────────────────────────────
// Parse Subjects
// ─────────────────────────────────────────────

export async function getSubjects(
  requestedStartYear?: number,
  force = false,
): Promise<{ winter: Subject[]; summer: Subject[] } & AcademicPeriodData> {
  const sessionId = await getSession();
  if (!sessionId) {
    const year = await resolveAcademicYear(requestedStartYear);
    return { winter: [], summer: [], ...year };
  }
  const year = await resolveStudyAcademicYear(sessionId, requestedStartYear, force);

  try {
    const html = await fetchPage(
      sessionId,
      `predmety_s.php?ra=${year.selectedStartYear}`,
      force,
    );
    const parsed = parseAivsSubjects(html);
    const toSubject = (item: (typeof parsed.winter)[number]): Subject => {
      const moodleUrl = resolveMoodleUrl(item.moodleHref) || "";
      return {
        id: `${year.selectedStartYear}-${item.semester}-${item.code}`,
        code: item.code,
        name: item.name,
        hasMoodle: Boolean(moodleUrl),
        moodleUrl,
        infoUrl: resolveSubjectInfoUrl(item.infoHref) || "",
      };
    };
    const winter = parsed.winter.map(toSubject);
    const summer = parsed.summer.map(toSubject);

    return { winter, summer, ...year };
  } catch (e) {
    console.error("Error parsing subjects:", e);
    return { winter: [], summer: [], ...year };
  }
}

// ─────────────────────────────────────────────
// Parse Grades
// ─────────────────────────────────────────────

export async function getGrades(
  requestedStartYear?: number,
  force = false,
): Promise<{ winter: Grade[]; summer: Grade[] } & AcademicPeriodData> {
  const sessionId = await getSession();
  if (!sessionId) {
    const year = await resolveAcademicYear(requestedStartYear);
    return { winter: [], summer: [], ...year };
  }
  const year = await resolveStudyAcademicYear(sessionId, requestedStartYear, force);

  try {
    const [html, subjectsHtml] = await Promise.all([
      fetchPage(
        sessionId,
        `svysledky.php?ra=${year.selectedStartYear}`,
        force,
      ),
      fetchPage(
        sessionId,
        `predmety_s.php?ra=${year.selectedStartYear}`,
        force,
      ),
    ]);
    const $ = cheerio.load(html);
    const parsedSubjects = parseAivsSubjects(subjectsHtml);
    const selectedSubjectCodes = new Set(
      [...parsedSubjects.winter, ...parsedSubjects.summer].map((subject) => subject.code),
    );

    const winter: Grade[] = [];
    const summer: Grade[] = [];
    let currentSemester: "winter" | "summer" | null = null;
    const seenGrades = new Set<string>();

    // Grades table structure:
    // <tr><td class="sep-mch">Zimný/Letný semester</td></tr>
    // <tr class="odd/evn"><td class="rgreen">...</td> x10 </tr>
    // Columns: Predmet, Pov., Ukon., Body za semester, Zápočet, Zn, Skúška, Zn, Kred., Body

    $("tr").each((_i, row) => {
      // Check for semester separator
      const sepCell = $(row).find("td.sep-mch");
      if (sepCell.length > 0) {
        const text = sepCell.text().trim().toLowerCase();
        if (text.includes("zimný")) currentSemester = "winter";
        else if (text.includes("letný")) currentSemester = "summer";
        return;
      }

      if (!currentSemester) return;

      // Only process data rows (odd/evn class)
      if (!$(row).hasClass("odd") && !$(row).hasClass("evn")) return;

      const resultsTable = $(row).closest("table.data.tien");
      if (resultsTable.length === 0) return;
      const tableAcademicYear = getAivsResultsTableYear(
        resultsTable.prevAll("table:not(.data)").first().text(),
      );

      const tds = $(row).find("td");
      if (tds.length < 9) return;

      const subjectText = $(tds[0]).text().trim();
      const codeMatch = subjectText.match(/^(\S+)\s+(.+)$/);
      if (!codeMatch) return;

      const code = codeMatch[1];
      const rawName = codeMatch[2];
      const subject = rawName.charAt(0).toUpperCase() + rawName.slice(1);

      // Column indices: 0=Predmet, 1=Pov, 2=Ukon, 3=Body semester, 4=Zápočet, 5=Zn, 6=Skúška, 7=Zn(final), 8=Kred, 9=Body
      const type = $(tds[1]).text().trim();
      const completionType = $(tds[2]).text().trim();
      const result = selectAivsGradeResult(
        completionType,
        $(tds[4]).text(),
        $(tds[5]).text(),
        $(tds[6]).text(),
        $(tds[7]).text(),
      );
      const creditsText = $(tds[8]).text().trim();
      const credits = parseFloat(creditsText) || 0;
      const points = $(tds[9])?.text()?.trim() || "";
      const datedAcademicYear = getAcademicYearStartFromSlovakDate(result.date);
      const identity = [
        tableAcademicYear ?? "unknown-year",
        currentSemester,
        code.toLocaleUpperCase("sk"),
        result.date,
        result.grade,
        credits,
        points,
      ].join("|");
      if (seenGrades.has(identity)) return;
      seenGrades.add(identity);

      const grade: Grade = {
        subject,
        code,
        grade: result.grade,
        credits,
        date: result.date,
        type,
        points: points || "—",
        // The upstream results table is cumulative and identical for multiple
        // selected years. Dates are authoritative for completed courses; the
        // selected subject list identifies still-ungraded courses.
        academicYearStart: tableAcademicYear ?? datedAcademicYear ?? (
          selectedSubjectCodes.has(code) ? year.selectedStartYear : null
        ),
      };

      if (currentSemester === "winter") winter.push(grade);
      else summer.push(grade);
    });

    return { winter, summer, ...year };
  } catch (e) {
    console.error("Error parsing grades:", e);
    return { winter: [], summer: [], ...year };
  }
}

async function getExamTermsInternal(
  requestedStartYear?: number,
  force = false,
): Promise<{ terms: InternalExamTerm[] } & AcademicPeriodData> {
  const sessionId = await getSession();
  if (!sessionId) {
    const year = await resolveAcademicYear(requestedStartYear);
    return { terms: [], ...year };
  }
  const year = await resolveStudyAcademicYear(sessionId, requestedStartYear, force);
  try {
    return { terms: await loadExamTermsForYear(sessionId, year.selectedStartYear, force), ...year };
  } catch (error) {
    console.error("Failed to load AIVS exam terms:", error instanceof Error ? error.message : "unknown");
    return { terms: [], ...year };
  }
}

async function loadExamTermsForYear(sessionId: string, academicYearStart: number, force = false) {
  const subjectsHtml = await fetchPage(sessionId, `predmety_s.php?ra=${academicYearStart}`, force);
  const parsed = parseAivsSubjects(subjectsHtml);
  const subjects = [...parsed.winter, ...parsed.summer].filter((subject) => subject.termsHref);
  const pages = await Promise.all(subjects.map(async (subject) => {
    const url = resolveExamTermsUrl(subject.termsHref);
    if (!url) return [];
    const parsedUrl = new URL(url);
    const page = `${parsedUrl.pathname.replace("/vzdelavanie/", "")}${parsedUrl.search}`;
    const html = await fetchPage(sessionId, page, force);
    return parseAivsExamTerms(html, subject.name, subject.code, academicYearStart, subject.termsHref);
  }));
  const unique = new Map<string, InternalExamTerm>();
  for (const term of pages.flat()) unique.set(term.id, term);
  return [...unique.values()].sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`));
}

export async function getExamTerms(
  requestedStartYear?: number,
  force = false,
): Promise<{ terms: ExamTerm[] } & AcademicPeriodData> {
  const result = await getExamTermsInternal(requestedStartYear, force);
  return {
    ...result,
    terms: result.terms.map(toPublicExamTerm),
  };
}

export async function getExamTermsForYear(academicYearStart: number): Promise<ExamTerm[]> {
  if (!Number.isInteger(academicYearStart) || academicYearStart < 2000 || academicYearStart > 2200) return [];
  const sessionId = await getSession();
  if (!sessionId) return [];
  const selection = await getAcademicYearOptions();
  if (!selection.options.some((year) => year.startYear === academicYearStart)) return [];
  try {
    return (await loadExamTermsForYear(sessionId, academicYearStart)).map(toPublicExamTerm);
  } catch (error) {
    console.error("Failed to load AIVS exam terms:", error instanceof Error ? error.message : "unknown");
    return [];
  }
}

function toPublicExamTerm(term: InternalExamTerm): ExamTerm {
  return {
    id: term.id,
    academicYearStart: term.academicYearStart,
    subject: term.subject,
    subjectCode: term.subjectCode,
    date: term.date,
    time: term.time,
    room: term.room,
    teacher: term.teacher,
    capacity: term.capacity,
    occupied: term.occupied,
    type: term.type,
    note: term.note,
    deadline: term.deadline,
    canRegister: term.canRegister,
    canCancel: term.canCancel,
  };
}

function examOperationResult<T>(
  status: IntegrationOperationResult<T>["status"],
  code: string,
  message: string,
  confirmedState?: T,
): IntegrationOperationResult<T> {
  return { status, code, message, confirmedState, checkedAt: new Date().toISOString() };
}

async function changeExamRegistration(
  termId: string,
  academicYearStart: number,
  action: "register" | "cancel",
): Promise<IntegrationOperationResult<ExamTerm>> {
  if (process.env.ENABLE_AIVS_EXAM_ACTIONS !== "true") {
    return examOperationResult("disabled", "actions_disabled", "Prihlasovanie na termíny je dočasne vypnuté.");
  }
  if (!termId || termId.length > 300 || !Number.isInteger(academicYearStart) || academicYearStart < 2000 || academicYearStart > 2200) {
    return examOperationResult("rejected", "invalid_input", "Neplatný termín.");
  }
  const sessionId = await getSession();
  if (!sessionId) return examOperationResult("rejected", "not_authenticated", "AIVS nie je pripojený.");
  const lockKey = `${sessionId}:${academicYearStart}:${termId}:${action}`;
  const now = Date.now();
  if ((examOperationLocks.get(lockKey) || 0) > now) {
    return examOperationResult("rejected", "already_processing", "Operácia sa už spracúva.");
  }
  if (examOperationLocks.size > 500) examOperationLocks.clear();
  examOperationLocks.set(lockKey, now + 30_000);

  try {
  const current = (await getExamTermsInternal(academicYearStart, true)).terms.find((term) => term.id === termId);
  if (!current) return examOperationResult("rejected", "term_not_found", "Termín už nie je dostupný.");
  if ((action === "register" && !current.canRegister) || (action === "cancel" && !current.canCancel)) {
    return examOperationResult("rejected", "action_not_allowed", "AIVS túto zmenu momentálne nepovoľuje.");
  }
  const actionUrl = resolveExamTermsUrl(current.actionHref);
  if (!actionUrl) return examOperationResult("rejected", "invalid_action", "AIVS neposkytol bezpečnú akciu pre tento termín.");

    const response = await fetch(actionUrl, { headers: { Cookie: `PHPSESSID=${sessionId}` }, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok && response.status !== 302 && response.status !== 303) return examOperationResult("uncertain", `http_${response.status}`, "Výsledok sa nepodarilo potvrdiť. Skontrolujte AIVS.");
    if (response.ok) {
      const html = new TextDecoder("windows-1250").decode(await response.arrayBuffer());
      if (html.includes('name="heslo"')) return examOperationResult("uncertain", "session_expired", "Výsledok sa nepodarilo potvrdiť. Skontrolujte AIVS.");
    }
    clearSessionCaches(sessionId);
    const confirmed = (await getExamTermsInternal(academicYearStart, true)).terms.find((term) => term.id === termId);
    const changed = action === "register" ? confirmed?.canCancel : confirmed?.canRegister || !confirmed;
    if (!changed) return examOperationResult("uncertain", "not_confirmed", "AIVS zmenu zatiaľ nepotvrdil.");
    return examOperationResult(
      "success",
      "success",
      action === "register" ? "Prihlásenie bolo potvrdené." : "Odhlásenie bolo potvrdené.",
      toPublicExamTerm(confirmed || current),
    );
  } catch {
    return examOperationResult("uncertain", "network_error", "Spojenie sa prerušilo. Pred opakovaním skontrolujte AIVS.");
  } finally {
    examOperationLocks.delete(lockKey);
  }
}

export async function registerExam(termId: string, academicYearStart: number) {
  return changeExamRegistration(termId, academicYearStart, "register");
}

export async function cancelExam(termId: string, academicYearStart: number) {
  return changeExamRegistration(termId, academicYearStart, "cancel");
}

// ─────────────────────────────────────────────
// Parse Schedule
// ─────────────────────────────────────────────


export async function getScheduleData(force = false): Promise<ScheduleData> {
  const sessionId = await getSession();
  if (!sessionId) return { items: [], status: "unauthenticated" };

  try {
    const year = await resolveAcademicYear();
    const html = await fetchPage(
      sessionId,
      `rozvrh2.php?ra=${year.selectedStartYear}`,
      force,
    );
    const sourceState = getAivsScheduleSourceState(html);
    if (sourceState !== "available") {
      return { items: [], status: sourceState };
    }
    const $ = cheerio.load(html);

    const items: ScheduleItem[] = [];
    const dayMap: Record<string, { full: string; short: string }> = {
      "Pondelok": { full: "Pondelok", short: "Po" },
      "Utorok": { full: "Utorok", short: "Ut" },
      "Streda": { full: "Streda", short: "St" },
      "Štvrtok": { full: "Štvrtok", short: "Št" },
      "Piatok": { full: "Piatok", short: "Pi" },
    };

    let id = 0;

    const formatTime = (totalMins: number, isEnd = false) => {
      let m = totalMins;
      if (isEnd && m % 60 === 0) {
        m -= 10; // Official UNIZA timetable uses 50-minute lessons and 10-minute breaks.
      }
      const hours = Math.floor(m / 60);
      const minutes = Math.round(m % 60);
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    };

    $(".rozvrh_tyzden").each((_i, dayRow) => {
      const dayName = $(dayRow).find(".rozvrh_nazov").text().trim();
      const dayInfo = dayMap[dayName];
      if (!dayInfo) return;

      let currentMinutes = 7 * 60; // 07:00

      $(dayRow).find("span[class*='rozvrh_bloky']").each((_j, block) => {
        const className = $(block).attr("class") || "";
        const style = $(block).attr("style") || "";
        const widthMatch = style.match(/width:\s*([\d.]+)/);
        const width = widthMatch ? parseFloat(widthMatch[1]) : 61;

        const durationMins = Math.round(width * (60 / 61));
        const isContinuation = className.match(/-(p|c|l)-c\b/);

        if (isContinuation) {
          if (items.length > 0 && items[items.length - 1].day === dayInfo.full) {
            const lastItem = items[items.length - 1];
            const newEndMins = currentMinutes + durationMins;
            lastItem.timeEnd = formatTime(newEndMins, true);
          }
        } else if (className !== "rozvrh_bloky") {
          let type: "lecture" | "exercise" | "lab" = "lecture";
          const blockText = $(block).text().trim();
          const blockTitle = ($(block).attr("title") || "").toLowerCase();

          if (blockText.startsWith("C") || className.match(/-(c|c-c)\b(-\w+)?/)) type = "exercise";
          else if (blockText.startsWith("L") || className.match(/-(l|l-c)\b(-\w+)?/)) type = "lab";
          else if (blockText.startsWith("P") || className.match(/-(p|p-c)\b(-\w+)?/)) type = "lecture";

          let color = "#f97316"; // povinný - oranžová
          if (className.includes("-pv") || className.includes("pvol") || blockTitle.includes("povinne volit")) {
            color = "#0ea5e9"; // povinne voliteľný - modrá
          } else if (className.includes("-v") || className.includes("vyb") || blockTitle.includes("výberov") || blockTitle.includes("vyberov")) {
            // we use "-v" because "rozvrh_bloky-p-v" is sometimes used for výberový
            if (!className.includes("-pv") && !className.includes("-pov")) {
              color = "#22c55e"; // výberový - zelená
            }
          }

          if (className.includes("-vyb")) color = "#22c55e";

          let teacher = "";
          let room = "";
          let subject = "";

          $(block).find("a").each((_k, link) => {
            const href = $(link).attr("href") || "";
            const text = $(link).text().trim();
            if (href.includes("sq=1")) teacher = text;
            else if (href.includes("sq=3")) room = text;
            else if (href.includes("sq=4")) subject = text;
          });

          if (subject) {
            items.push({
              id: `sch${id++}`,
              day: dayInfo.full,
              dayShort: dayInfo.short,
              timeStart: formatTime(currentMinutes),
              timeEnd: formatTime(currentMinutes + durationMins, true),
              room,
              subject,
              type,
              color,
              teacher,
              timeInfo: "",
            });
          }
        }

        currentMinutes += durationMins;
      });
    });

    const uniqueItems = new Map<string, ScheduleItem>();
    for (const item of items) {
      const key = [item.day, item.timeStart, item.timeEnd, item.subject, item.room, item.teacher, item.type].join("|");
      if (!uniqueItems.has(key)) uniqueItems.set(key, item);
    }
    const parsedItems = [...uniqueItems.values()];
    return {
      items: parsedItems,
      status: parsedItems.length > 0 ? "ready" : "empty",
    };
  } catch (e) {
    console.error("Error parsing schedule:", e);
    return { items: [], status: "error" };
  }
}

export async function getSchedule(force = false): Promise<ScheduleItem[]> {
  return (await getScheduleData(force)).items;
}

// ─────────────────────────────────────────────
// Parse Subject Info Sheet (Informačný list)
// ─────────────────────────────────────────────

export type SubjectInfo = {
  code: string;
  name: string;
  faculty: string;
  university: string;
  credits: string;
  obligation: string;
  completion: string;
  hours: string;
  method: string;
  workload: string;
  conditions: string;
  outcomes: string;
  syllabus: string;
  literature: string;
  teacher: string;
  guarantor: string;
};

export async function getSubjectInfo(infoUrl: string): Promise<SubjectInfo | null> {
  const sessionId = await getSession();
  if (!sessionId) return null;

  try {
    const url = resolveSubjectInfoUrl(infoUrl);
    if (!url) return null;
    const html = await fetchDecoded(url, {
      headers: { Cookie: `PHPSESSID=${sessionId}` },
    });

    const $ = cheerio.load(html);
    const table = $("#id-tabulka-inf-list-predmetu");
    if (table.length === 0) return null;

    const info: SubjectInfo = {
      code: "", name: "", faculty: "", university: "",
      credits: "", obligation: "", completion: "",
      hours: "", method: "", workload: "", conditions: "",
      outcomes: "", syllabus: "", literature: "",
      teacher: "", guarantor: "",
    };

    table.find("tr").each((_i, row) => {
      const tds = $(row).find("td");
      const fullText = $(row).text().trim();

      if (fullText.startsWith("Vysoká škola:")) {
        info.university = fullText.replace("Vysoká škola:", "").trim();
      } else if (fullText.startsWith("Fakulta:")) {
        info.faculty = fullText.replace("Fakulta:", "").trim();
      } else if (fullText.includes("Kód predmetu:") && fullText.includes("Názov predmetu:")) {
        const codeTd = $(tds[0]).text().trim();
        const nameTd = $(tds[1]).text().trim();
        info.code = codeTd.replace("Kód predmetu:", "").trim();
        const rawName = nameTd.replace("Názov predmetu:", "").trim();
        info.name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      } else if (fullText.includes("Počet kreditov:")) {
        info.credits = fullText.replace("Počet kreditov:", "").trim();
      } else if (fullText.includes("Záťaž študenta:")) {
        info.workload = fullText.replace("Záťaž študenta:", "").trim();
      } else if (fullText.includes("Atribúty predmetu:")) {
        const attrText = $(tds[1])?.text()?.trim() || "";
        const oblMatch = attrText.match(/Povinnosť:\s*(.*?)(?:Ukončenie:|$)/);
        const compMatch = attrText.match(/Ukončenie:\s*(.*?)(?:Predmet|$)/);
        if (oblMatch) info.obligation = oblMatch[1].trim();
        if (compMatch) info.completion = compMatch[1].trim();
      } else if (fullText.includes("Prednášky:") && fullText.includes("Cvičenia:") && !fullText.includes("Metódy")) {
        info.hours = $(tds[1])?.text()?.trim() || fullText;
      } else if (fullText.includes("Podmienky na absolvovanie")) {
        // This might span multiple rows, grab the content
        info.conditions = $(tds[1])?.text()?.trim() || $(tds[0])?.text()?.replace("Podmienky na absolvovanie predmetu:", "").trim() || "";
      } else if (fullText.includes("Výsledky vzdelávania")) {
        info.outcomes = $(tds[1])?.text()?.trim() || $(tds[0])?.text()?.replace("Výsledky vzdelávania:", "").trim() || "";
      } else if (fullText.includes("Stručná osnova predmetu")) {
        info.syllabus = $(tds[1])?.text()?.trim() || $(tds[0])?.text()?.replace("Stručná osnova predmetu:", "").trim() || "";
      } else if (fullText.includes("Odporúčaná literatúra")) {
        info.literature = $(tds[1])?.text()?.trim() || $(tds[0])?.text()?.replace("Odporúčaná literatúra:", "").trim() || "";
      } else if (fullText.includes("Vyučujúci:")) {
        info.teacher = fullText.replace("Vyučujúci:", "").trim();
      } else if (fullText.includes("Garant predmetu:")) {
        info.guarantor = fullText.replace("Garant predmetu:", "").trim();
      }
    });

    return info;
  } catch (e) {
    console.error("Error parsing subject info:", e);
    return null;
  }
}

