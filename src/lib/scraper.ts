"use server";

import { cookies } from "next/headers";
import * as cheerio from "cheerio";
import { rateLimit } from "@/lib/rate-limit";

const BASE_URL = "https://vzdelavanie.uniza.sk/vzdelavanie";

// ─────────────────────────────────────────────
// Fetch with Windows-1250 decoding
// ─────────────────────────────────────────────

async function fetchDecoded(url: string, options?: RequestInit): Promise<string> {
  const res = await fetch(url, { ...options, cache: "no-store" });
  const buffer = await res.arrayBuffer();
  const decoder = new TextDecoder("windows-1250");
  return decoder.decode(buffer);
}

// ─────────────────────────────────────────────
// Session Management
// ─────────────────────────────────────────────

async function getPhpSession(email: string, password: string): Promise<string | null> {
  // Step 1: Get initial PHPSESSID
  const loginPageRes = await fetch(`${BASE_URL}/login.php`, { redirect: "manual" });
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
  });

  // Step 3: Verify session and pre-fetch all essential pages in parallel to warm up the cache
  const [testHtml, gradesHtml, scheduleHtml, indexHtml, planyHtml] = await Promise.all([
    fetchDecoded(`${BASE_URL}/predmety_s.php`, {
      headers: { Cookie: `PHPSESSID=${phpSessionId}` },
      redirect: "manual",
    }),
    fetchDecoded(`${BASE_URL}/svysledky.php`, {
      headers: { Cookie: `PHPSESSID=${phpSessionId}` },
      redirect: "manual",
    }),
    fetchDecoded(`${BASE_URL}/rozvrh2.php`, {
      headers: { Cookie: `PHPSESSID=${phpSessionId}` },
      redirect: "manual",
    }),
    fetchDecoded(`${BASE_URL}/index.php`, {
      headers: { Cookie: `PHPSESSID=${phpSessionId}` },
      redirect: "manual",
    }),
    fetchDecoded(`${BASE_URL}/plany.php`, {
      headers: { Cookie: `PHPSESSID=${phpSessionId}` },
      redirect: "manual",
    }),
  ]);

  if (testHtml.includes('name="heslo"')) {
    return null; // Still on login page — auth failed
  }

  // Inject pre-fetched results directly into PAGE_CACHE
  const now = Date.now();
  if (PAGE_CACHE.size > 500) PAGE_CACHE.clear();
  PAGE_CACHE.set(`${phpSessionId}_predmety_s.php`, { html: testHtml, timestamp: now });
  PAGE_CACHE.set(`${phpSessionId}_svysledky.php`, { html: gradesHtml, timestamp: now });
  PAGE_CACHE.set(`${phpSessionId}_rozvrh2.php`, { html: scheduleHtml, timestamp: now });
  PAGE_CACHE.set(`${phpSessionId}_index.php`, { html: indexHtml, timestamp: now });
  PAGE_CACHE.set(`${phpSessionId}_plany.php`, { html: planyHtml, timestamp: now });

  return phpSessionId;
}

const PAGE_CACHE = new Map<string, { html: string; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchPage(sessionId: string, page: string): Promise<string> {
  const cacheKey = `${sessionId}_${page}`;

  if (PAGE_CACHE.has(cacheKey)) {
    const cached = PAGE_CACHE.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.html;
    }
  }

  let html = await fetchDecoded(`${BASE_URL}/${page}`, {
    headers: { Cookie: `PHPSESSID=${sessionId}` },
  });

  // Check if session has expired on the server by looking for the login page
  if (html.includes('name="heslo"') || html.includes('<title>Prihlásenie</title>')) {
    const cookieStore = await cookies();
    const email = cookieStore.get("uniza_email")?.value;
    const pass = cookieStore.get("uniza_pass")?.value;

    if (email && pass) {
      const newSessionId = await getPhpSession(email, pass);
      if (newSessionId) {
        cookieStore.set("uniza_phpsessid", newSessionId, {
          httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30, // 30 days
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        });

        // Retry fetch with new active session
        html = await fetchDecoded(`${BASE_URL}/${page}`, {
          headers: { Cookie: `PHPSESSID=${newSessionId}` },
        });

        // Prevent memory leaks
        if (PAGE_CACHE.size > 500) PAGE_CACHE.clear();
        PAGE_CACHE.set(`${newSessionId}_${page}`, { html, timestamp: Date.now() });
      }
    }
  } else {
    // Prevent memory leaks
    if (PAGE_CACHE.size > 500) PAGE_CACHE.clear();
    PAGE_CACHE.set(cacheKey, { html, timestamp: Date.now() });
  }

  return html;
}

// ─────────────────────────────────────────────
// Auth Actions
// ─────────────────────────────────────────────

export async function login(formData: FormData) {
  const email = formData.get("email")?.toString()?.trim();
  const password = formData.get("password")?.toString();

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

  const sessionId = await getPhpSession(email, password);
  if (!sessionId) {
    return { error: "Nesprávne prihlasovacie údaje" };
  }

  const cookieStore = await cookies();
  cookieStore.set("uniza_phpsessid", sessionId, {
    httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30, // 30 days
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  cookieStore.set("uniza_email", email, {
    httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30, // 30 days
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  cookieStore.set("uniza_pass", password, {
    httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30, // 30 days
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return { success: true };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("uniza_phpsessid");
  cookieStore.delete("uniza_email");
  cookieStore.delete("uniza_pass");
  return { success: true };
}

export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get("uniza_phpsessid")?.value;

  if (!sessionId) {
    const email = cookieStore.get("uniza_email")?.value;
    const pass = cookieStore.get("uniza_pass")?.value;
    if (email && pass) {
      sessionId = await getPhpSession(email, pass) || undefined;
      if (sessionId) {
        cookieStore.set("uniza_phpsessid", sessionId, {
          httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30, // 30 days
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        });
      }
    }
  }

  return sessionId || null;
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

// ─────────────────────────────────────────────
export async function getUserInfo(explicitSessionId?: string, explicitEmail?: string) {
  const cookieStore = await cookies();
  const email = explicitEmail || cookieStore.get("uniza_email")?.value || "student@stud.uniza.sk";

  // Default values
  let name = email.split("@")[0];
  name = name.charAt(0).toUpperCase() + name.slice(1);
  let group = "Neznáma";
  let personalNumber = "Neznáme";
  let faculty = "Žilinská univerzita v Žiline";
  let program = "Neznámy program";

  const sessionId = explicitSessionId || await getSession();
  if (sessionId) {
    try {
      const [indexHtml, svysledkyHtml, predmetyHtml] = await Promise.all([
        fetchPage(sessionId, "index.php"),
        fetchPage(sessionId, "svysledky.php"),
        fetchPage(sessionId, "predmety_s.php"),
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
      const $predm = cheerio.load(predmetyHtml);
      const predmText = $predm("body").text().replace(/\s+/g, ' ');
      // Look for "Fakulta: " and capture up to "Miesto:", "Štud", "Akad", etc.
      const pFaculty = predmText.match(/Fakulta:\s*(Fakulta [a-zA-ZáäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ\s]+?)\s*(?:Akad|Štud|Miest|Predm|Zimn|Letn|\d)/i);
      if (pFaculty && pFaculty[1]) {
        faculty = pFaculty[1].trim();
      }

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
    academicYear: "2025/2026",
  };
}

// ─────────────────────────────────────────────
// Parse Subjects
// ─────────────────────────────────────────────

export async function getSubjects(): Promise<{ winter: Subject[]; summer: Subject[] }> {
  const sessionId = await getSession();
  if (!sessionId) return { winter: [], summer: [] };

  try {
    const html = await fetchPage(sessionId, "predmety_s.php");
    const $ = cheerio.load(html);

    const winter: Subject[] = [];
    const summer: Subject[] = [];
    let currentSemester: "winter" | "summer" | null = null;
    let id = 0;

    // The subjects table is nested:  #id-tabulka-predmety-s > tr > td > table > rows
    // So we select ALL tr inside the outer table
    $("#id-tabulka-predmety-s tr").each((_i, row) => {
      // Check for semester separator
      const sepCell = $(row).find("td.sep");
      if (sepCell.length > 0) {
        const text = sepCell.text().trim().toLowerCase();
        if (text.includes("zimný")) currentSemester = "winter";
        else if (text.includes("letný")) currentSemester = "summer";
        return;
      }

      if (!currentSemester) return;

      // Skip header rows
      if ($(row).find("td.hdr").length > 0 || $(row).hasClass("hdr")) return;

      const firstTd = $(row).find("td").first();
      const cellText = firstTd.text().trim();
      if (!cellText) return;

      // Extract subject code and name
      // Format: "6BM0027 základy ekonómie"
      const codeMatch = cellText.match(/^(\S+)\s+(.+)$/);
      if (!codeMatch) return;

      const code = codeMatch[1];
      const rawName = codeMatch[2];
      // Capitalize first letter
      const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);

      // Get links
      const infoLink = firstTd.find("a[href*='planinfo']").first();
      const infoUrl = infoLink.attr("href") || "";

      const moodleLink = $(row).find('a[target="tmoodle"]');
      const hasMoodle = moodleLink.length > 0;
      const moodleUrl = moodleLink.attr("href") || "";

      const subject: Subject = {
        id: `s${id++}`,
        code,
        name,
        hasMoodle,
        moodleUrl,
        infoUrl: infoUrl ? `${BASE_URL}/${infoUrl}` : "",
      };

      if (currentSemester === "winter") winter.push(subject);
      else summer.push(subject);
    });

    return { winter, summer };
  } catch (e) {
    console.error("Error parsing subjects:", e);
    return { winter: [], summer: [] };
  }
}

// ─────────────────────────────────────────────
// Parse Grades
// ─────────────────────────────────────────────

export async function getGrades(): Promise<{ winter: Grade[]; summer: Grade[] }> {
  const sessionId = await getSession();
  if (!sessionId) return { winter: [], summer: [] };

  try {
    const html = await fetchPage(sessionId, "svysledky.php");
    const $ = cheerio.load(html);

    const winter: Grade[] = [];
    const summer: Grade[] = [];
    let currentSemester: "winter" | "summer" | null = null;

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
      const examDate = $(tds[6]).text().trim();
      const finalGrade = $(tds[7]).text().trim();
      const creditsText = $(tds[8]).text().trim();
      const credits = parseFloat(creditsText) || 0;
      const points = $(tds[9])?.text()?.trim() || "";

      const grade: Grade = {
        subject,
        code,
        grade: finalGrade || "—",
        credits,
        date: examDate || "",
        type,
        points: points || "—",
      };

      if (currentSemester === "winter") winter.push(grade);
      else summer.push(grade);
    });

    return { winter, summer };
  } catch (e) {
    console.error("Error parsing grades:", e);
    return { winter: [], summer: [] };
  }
}

// ─────────────────────────────────────────────
// Parse Schedule
// ─────────────────────────────────────────────


export async function getSchedule(): Promise<ScheduleItem[]> {
  const sessionId = await getSession();
  if (!sessionId) return [];

  try {
    const html = await fetchPage(sessionId, "rozvrh2.php");
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
        m -= 15; // UNIZA classes usually end 15 mins before the hour
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

          if (blockText.startsWith("C") || className.match(/-(c|c-c)\b(-\w+)?/)) type = "exercise";
          else if (blockText.startsWith("L") || className.match(/-(l|l-c)\b(-\w+)?/)) type = "lab";
          else if (blockText.startsWith("P") || className.match(/-(p|p-c)\b(-\w+)?/)) type = "lecture";

          let color = "#f97316"; // povinný - oranžová
          if (className.includes("pvol")) color = "#0ea5e9"; // povinne voliteľný - modrá
          else if (className.includes("vyb")) color = "#22c55e"; // výberový - zelená

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

    return items;
  } catch (e) {
    console.error("Error parsing schedule:", e);
    return [];
  }
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
    // Extract the relative path or use full URL
    const url = infoUrl.startsWith("http") ? infoUrl : `${BASE_URL}/${infoUrl}`;
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

