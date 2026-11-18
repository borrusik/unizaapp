import "server-only";

import { cookies } from "next/headers";
import type { AivsResultTotals, AivsYearResults } from "@/lib/aivs-grades";
import type { ExamTerm } from "@/lib/aivs-exams";
import type { DirectoryPerson } from "@/lib/directory-search";
import type { InstagramDailyMenu } from "@/lib/instagram-menu";
import { getBratislavaDateKey, listDateKeys, type Canteen, type MenuDay, type MenuItem, type WebKreditOrder } from "@/lib/uniza-parsers";
import type { StravaHistoryItem } from "@/lib/webkredit-history";
import type { Grade, ScheduleItem, Subject, SubjectInfo } from "@/lib/scraper";

// Demo mode serves invented data so the app can be explored, screenshotted and
// designed without a UNIZA account. It never contacts AIVS or WebKredit.
export const DEMO_COOKIE = "uniza_demo";
export const DEMO_EMAIL = "demo@stud.uniza.sk";

export async function isDemoSession(): Promise<boolean> {
  return (await cookies()).get(DEMO_COOKIE)?.value === "1";
}

export function demoOperationResult<T>() {
  return {
    status: "disabled" as const,
    code: "demo_mode",
    message: "V ukážkovom režime sa zmeny neodosielajú.",
    confirmedState: undefined as T | undefined,
    checkedAt: new Date().toISOString(),
  };
}

function currentStartYear(now = new Date()) {
  const [year, month] = getBratislavaDateKey(now).split("-").map(Number);
  return month >= 9 ? year : year - 1;
}

function academicYears() {
  const start = currentStartYear();
  return [start, start - 1, start - 2].map((startYear) => ({ startYear, label: `${startYear}/${startYear + 1}` }));
}

function resolveYear(requested?: number) {
  const years = academicYears();
  const selectedStartYear = years.some((year) => year.startYear === requested) ? requested! : years[0].startYear;
  return { selectedStartYear, academicYear: `${selectedStartYear}/${selectedStartYear + 1}`, academicYears: years };
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function slovakDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${day}.${month}.${year}`;
}

type DemoCourse = {
  code: string;
  name: string;
  credits: number;
  semester: "winter" | "summer";
  type: "P" | "PV" | "V";
  teacher: string;
};

// Courses per year offset from the current academic year (0 = current).
const COURSES: Record<number, DemoCourse[]> = {
  0: [
    { code: "5BI201", name: "Algoritmy a údajové štruktúry 2", credits: 6, semester: "winter", type: "P", teacher: "doc. Ing. Peter Kováč, PhD." },
    { code: "5BI202", name: "Operačné systémy", credits: 6, semester: "winter", type: "P", teacher: "Ing. Martin Horváth, PhD." },
    { code: "5BI203", name: "Databázové systémy", credits: 5, semester: "winter", type: "P", teacher: "Ing. Jana Novotná, PhD." },
    { code: "5BI204", name: "Pravdepodobnosť a štatistika", credits: 5, semester: "winter", type: "P", teacher: "doc. RNDr. Eva Bieliková, PhD." },
    { code: "5BI205", name: "Vývoj webových aplikácií", credits: 4, semester: "winter", type: "PV", teacher: "Ing. Tomáš Šimko" },
    { code: "5BI206", name: "Anglický jazyk 3", credits: 2, semester: "winter", type: "V", teacher: "Mgr. Lucia Hrušková" },
    { code: "5BI211", name: "Počítačové siete", credits: 6, semester: "summer", type: "P", teacher: "Ing. Michal Kraus, PhD." },
    { code: "5BI212", name: "Softvérové inžinierstvo", credits: 6, semester: "summer", type: "P", teacher: "doc. Ing. Peter Kováč, PhD." },
    { code: "5BI213", name: "Strojové učenie", credits: 5, semester: "summer", type: "PV", teacher: "Ing. Jana Novotná, PhD." },
  ],
  1: [
    { code: "5BI101", name: "Algoritmy a údajové štruktúry 1", credits: 6, semester: "winter", type: "P", teacher: "doc. Ing. Peter Kováč, PhD." },
    { code: "5BI102", name: "Matematická analýza 2", credits: 6, semester: "winter", type: "P", teacher: "doc. RNDr. Eva Bieliková, PhD." },
    { code: "5BI103", name: "Objektovo orientované programovanie", credits: 6, semester: "winter", type: "P", teacher: "Ing. Martin Horváth, PhD." },
    { code: "5BI104", name: "Anglický jazyk 2", credits: 2, semester: "winter", type: "V", teacher: "Mgr. Lucia Hrušková" },
    { code: "5BI111", name: "Architektúra počítačov", credits: 6, semester: "summer", type: "P", teacher: "Ing. Michal Kraus, PhD." },
    { code: "5BI112", name: "Diskrétna matematika", credits: 5, semester: "summer", type: "P", teacher: "doc. RNDr. Eva Bieliková, PhD." },
    { code: "5BI113", name: "Úvod do kybernetickej bezpečnosti", credits: 4, semester: "summer", type: "PV", teacher: "Ing. Tomáš Šimko" },
  ],
  2: [
    { code: "5BI001", name: "Základy programovania", credits: 6, semester: "winter", type: "P", teacher: "Ing. Martin Horváth, PhD." },
    { code: "5BI002", name: "Matematická analýza 1", credits: 6, semester: "winter", type: "P", teacher: "doc. RNDr. Eva Bieliková, PhD." },
    { code: "5BI003", name: "Algebra", credits: 5, semester: "winter", type: "P", teacher: "doc. RNDr. Eva Bieliková, PhD." },
    { code: "5BI011", name: "Princípy počítačov", credits: 6, semester: "summer", type: "P", teacher: "Ing. Michal Kraus, PhD." },
    { code: "5BI012", name: "Informatika 2", credits: 6, semester: "summer", type: "P", teacher: "Ing. Martin Horváth, PhD." },
    { code: "5BI013", name: "Anglický jazyk 1", credits: 2, semester: "summer", type: "V", teacher: "Mgr. Lucia Hrušková" },
  ],
};

const PAST_GRADES = ["A", "B", "A", "C", "B", "A", "D", "B", "E", "A"];
const GRADE_VALUES: Record<string, number> = { A: 1, B: 1.5, C: 2, D: 2.5, E: 3, FX: 4 };
const GRADE_POINTS: Record<string, string> = { A: "95", B: "86", C: "78", D: "71", E: "63" };

function coursesFor(startYear: number) {
  return COURSES[currentStartYear() - startYear] ?? [];
}

function infoUrl(code: string) {
  return `https://vzdelavanie.uniza.sk/vzdelavanie/planinfo.php?kod=${code}`;
}

function toSubject(startYear: number, course: DemoCourse, index: number): Subject {
  return {
    id: `${startYear}-${course.semester}-${course.code}`,
    code: course.code,
    name: course.name,
    hasMoodle: index % 3 !== 2,
    moodleUrl: index % 3 !== 2 ? `https://moodle.uniza.sk/course/view.php?id=${4100 + index}` : "",
    infoUrl: infoUrl(course.code),
  };
}

export function demoSubjects(requestedStartYear?: number) {
  const year = resolveYear(requestedStartYear);
  const subjects = coursesFor(year.selectedStartYear).map((course, index) => ({ course, subject: toSubject(year.selectedStartYear, course, index) }));
  return {
    winter: subjects.filter(({ course }) => course.semester === "winter").map(({ subject }) => subject),
    summer: subjects.filter(({ course }) => course.semester === "summer").map(({ subject }) => subject),
    ...year,
  };
}

function allGrades(): Grade[] {
  const current = currentStartYear();
  let gradeIndex = 0;
  return [2, 1, 0].flatMap((offset) => {
    const startYear = current - offset;
    return COURSES[offset].map((course) => {
      const finished = offset > 0;
      const grade = finished ? PAST_GRADES[gradeIndex++ % PAST_GRADES.length] : "";
      const examDate = course.semester === "winter" ? `${startYear + 1}-01-${String(12 + (gradeIndex % 10)).padStart(2, "0")}` : `${startYear + 1}-06-${String(5 + (gradeIndex % 15)).padStart(2, "0")}`;
      return {
        subject: course.name,
        code: course.code,
        grade,
        credits: course.credits,
        date: finished ? slovakDate(examDate) : "",
        type: course.type,
        points: finished ? GRADE_POINTS[grade] ?? "—" : "—",
        semesterPoints: finished ? String(Math.round(Number(GRADE_POINTS[grade] ?? 60) * 0.4)) : String(8 + course.credits * 2),
        academicYearStart: startYear,
      } satisfies Grade;
    });
  });
}

function totals(grades: Grade[]): AivsResultTotals {
  const graded = grades.filter((grade) => GRADE_VALUES[grade.grade] !== undefined);
  const credits = graded.reduce((sum, grade) => sum + grade.credits, 0);
  const weighted = graded.reduce((sum, grade) => sum + GRADE_VALUES[grade.grade] * grade.credits, 0);
  return {
    average: credits ? Math.round((weighted / credits) * 100) / 100 : null,
    credits,
    points: graded.reduce((sum, grade) => sum + Number(grade.points) || 0, 0),
  };
}

export function demoGrades(requestedStartYear?: number) {
  const year = resolveYear(requestedStartYear);
  const grades = allGrades();
  const winter = grades.filter((grade) => coursesFor(grade.academicYearStart ?? 0).some((course) => course.code === grade.code && course.semester === "winter"));
  const summer = grades.filter((grade) => !winter.includes(grade));
  const years: AivsYearResults[] = year.academicYears.map(({ startYear, label }) => {
    const inYear = grades.filter((grade) => grade.academicYearStart === startYear);
    return {
      startYear,
      label,
      total: totals(inYear),
      winter: totals(inYear.filter((grade) => winter.includes(grade))),
      summer: totals(inYear.filter((grade) => summer.includes(grade))),
    };
  });
  return {
    winter,
    summer,
    accountKey: "demo",
    official: { years, total: totals(grades) },
    ...year,
  };
}

export function demoUserInfo() {
  return {
    name: "Demo Študent",
    email: DEMO_EMAIL,
    faculty: "Fakulta riadenia a informatiky",
    program: "Informatika",
    group: "5ZYI24",
    personalNumber: "000000",
    academicYear: resolveYear().academicYear,
  };
}

const DAYS = [
  { full: "Pondelok", short: "Po" },
  { full: "Utorok", short: "Ut" },
  { full: "Streda", short: "St" },
  { full: "Štvrtok", short: "Št" },
  { full: "Piatok", short: "Pi" },
];

const COLORS = { P: "#f97316", PV: "#0ea5e9", V: "#22c55e" } as const;

// [day index, start, end, course code, type, room]
const TIMETABLE: Array<[number, string, string, string, ScheduleItem["type"], string]> = [
  [0, "08:00", "09:50", "5BI201", "lecture", "RA013"],
  [0, "10:00", "11:50", "5BI203", "exercise", "RC009"],
  [0, "13:00", "14:50", "5BI205", "lab", "RB054"],
  [1, "09:00", "10:50", "5BI202", "lecture", "AF2N1"],
  [1, "11:00", "12:50", "5BI201", "exercise", "RC012"],
  [1, "14:00", "15:50", "5BI206", "exercise", "RA302"],
  [2, "08:00", "09:50", "5BI204", "lecture", "AE"],
  [2, "10:00", "11:50", "5BI202", "lab", "RB051"],
  [2, "12:00", "13:50", "5BI203", "lecture", "RA013"],
  [2, "15:00", "16:50", "5BI204", "exercise", "RC010"],
  [3, "09:00", "10:50", "5BI205", "lecture", "AF2N1"],
  [3, "12:00", "13:50", "5BI201", "lab", "RB054"],
  [4, "08:00", "09:50", "5BI203", "lab", "RB052"],
  [4, "10:00", "11:50", "5BI204", "exercise", "RC009"],
];

export function demoSchedule() {
  const courses = COURSES[0];
  const items: ScheduleItem[] = TIMETABLE.map(([day, timeStart, timeEnd, code, type, room], index) => {
    const course = courses.find((candidate) => candidate.code === code)!;
    return {
      id: `demo-sch${index}`,
      day: DAYS[day].full,
      dayShort: DAYS[day].short,
      timeStart,
      timeEnd,
      room,
      subject: course.name,
      type,
      color: COLORS[course.type],
      teacher: course.teacher,
      timeInfo: "",
    };
  });
  return { items, status: "ready" as const };
}

export function demoExamTerms(requestedStartYear?: number) {
  const year = resolveYear(requestedStartYear);
  const today = getBratislavaDateKey(new Date());
  const courses = coursesFor(year.selectedStartYear).filter((course) => course.semester === "winter" && course.type !== "V");
  const terms: ExamTerm[] = courses.flatMap((course, index) => [0, 1].map((attempt) => {
    const date = year.selectedStartYear === currentStartYear()
      ? addDays(today, 6 + index * 5 + attempt * 14)
      : `${year.selectedStartYear + 1}-01-${String(10 + index * 3 + attempt * 7).padStart(2, "0")}`;
    const isPast = date < today;
    const registered = !isPast && attempt === 0 && index === 0;
    const capacity = 40 + index * 10;
    return {
      id: `demo-${course.code}-${attempt}`,
      academicYearStart: year.selectedStartYear,
      subject: course.name,
      subjectCode: course.code,
      date,
      time: ["08:00", "09:30", "12:00", "13:30"][(index + attempt) % 4],
      room: ["RA013", "AF2N1", "AE", "RC009"][(index + attempt) % 4],
      teacher: course.teacher,
      capacity,
      occupied: Math.min(capacity, 12 + index * 7 + attempt * 5),
      type: attempt === 0 ? "Riadny termín" : "Opravný termín",
      note: index === 1 && attempt === 0 ? "Písomná a ústna časť" : "",
      deadline: isPast ? "" : slovakDate(addDays(date, -2)),
      canRegister: !isPast && !registered,
      canCancel: registered,
    } satisfies ExamTerm;
  })).sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`));
  return { terms, loadStatus: "ready" as const, ...year };
}

export function demoSubjectInfo(url: string): SubjectInfo | null {
  let code = "";
  try {
    code = new URL(url).searchParams.get("kod") ?? "";
  } catch {
    return null;
  }
  const course = Object.values(COURSES).flat().find((candidate) => candidate.code === code);
  if (!course) return null;
  return {
    code: course.code,
    name: course.name,
    faculty: "Fakulta riadenia a informatiky",
    university: "Žilinská univerzita v Žiline",
    credits: String(course.credits),
    obligation: course.type === "P" ? "povinný" : course.type === "PV" ? "povinne voliteľný" : "výberový",
    completion: course.type === "V" ? "klasifikovaný zápočet" : "skúška",
    hours: "Prednášky: 2 hod. Cvičenia: 2 hod.",
    method: "prezenčná",
    workload: `${course.credits * 25} hodín`,
    conditions: "Priebežné hodnotenie: 40 bodov za semestrálny projekt a testy.\nZáverečné hodnotenie: 60 bodov za písomnú skúšku.",
    outcomes: "Študent ovláda základné pojmy predmetu a vie ich aplikovať pri riešení praktických úloh.",
    syllabus: "1. Úvod a motivácia\n2. Základné pojmy\n3. Praktické techniky\n4. Prípadové štúdie\n5. Opakovanie",
    literature: "Ukážková učebnica pre predmet, 2. vydanie. EDIS, 2024.",
    teacher: course.teacher,
    guarantor: course.teacher,
  };
}

const CANTEENS: Canteen[] = [
  { id: 1, name: "Nová menza", code: "NM" },
  { id: 2, name: "Bufet Veľký Diel", code: "VD" },
  { id: 3, name: "Jedáleň Hliny", code: "HL" },
];

const MEALS: Array<[string, string, string, string]> = [
  ["Polievka", "Paradajková polievka s ryžou", "0,30 l", "1,9"],
  ["Polievka", "Kurací vývar s rezancami", "0,30 l", "1,3,9"],
  ["Hlavné jedlo", "Kuracie prsia na grile, ryžové rizoto, šalát", "150 g", "7"],
  ["Hlavné jedlo", "Bravčový rezeň, zemiaková kaša", "120 g", "1,3,7"],
  ["Hlavné jedlo", "Cestoviny s pestom a parmezánom", "350 g", "1,7,8"],
  ["Hlavné jedlo", "Hovädzí guláš, knedľa", "120 g", "1,3,7,9"],
  ["Fit menu", "Šošovicový šalát s tvarohom a zeleninou", "300 g", "7"],
  ["Fit menu", "Pečený losos, dusená zelenina", "120 g", "4"],
];

function menuItem(date: string, canteenId: number, index: number, alternative: number): MenuItem {
  const [mealKindName, mealName, mealSize, allergens] = MEALS[index % MEALS.length];
  const price = mealKindName === "Polievka" ? "0,50 €" : mealKindName === "Fit menu" ? "3,40 €" : "2,90 €";
  return {
    id: `demo-${date}-${canteenId}-${index}`,
    date,
    canteenId,
    mealKindName,
    alternative,
    mealName,
    mealSize,
    price,
    allergens,
    note: "",
    mealKindId: mealKindName === "Polievka" ? 1 : mealKindName === "Fit menu" ? 3 : 2,
    state: null,
    canOrder: false,
    orderInAdvance: false,
    countAvailable: 40 + index * 5,
    countOrdered: 10 + index * 3,
    imageId: "",
    nutritionalValues: "",
    pictograms: [],
    composites: [],
    compositeMaxWeight: null,
  };
}

function isWeekend(dateKey: string) {
  const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function demoStravaDashboard(canteenId = 1) {
  const selectedCanteenId = CANTEENS.some((canteen) => canteen.id === canteenId) ? canteenId : 1;
  const today = getBratislavaDateKey(new Date());
  const requestedDates = listDateKeys(today, 5);
  const days: MenuDay[] = requestedDates.filter((date) => !isWeekend(date)).map((date, dayIndex) => {
    const offset = dayIndex + selectedCanteenId;
    const soups = [menuItem(date, selectedCanteenId, offset % 2, 1)];
    const mains = [0, 1, 2].map((alt) => menuItem(date, selectedCanteenId, 2 + ((offset + alt) % 4), alt + 1));
    const fit = [menuItem(date, selectedCanteenId, 6 + (offset % 2), 1)];
    return {
      date,
      groups: [
        { mealKindName: "Polievka", items: soups },
        { mealKindName: "Hlavné jedlo", items: mains },
        { mealKindName: "Fit menu", items: fit },
      ],
    };
  });
  const firstDay = days[0];
  const orders: WebKreditOrder[] = firstDay ? [{
    id: "demo-order-1",
    date: firstDay.date,
    mealKindId: 2,
    mealKind: "Hlavné jedlo",
    alternative: 1,
    name: firstDay.groups[1].items[0].mealName,
    canteenId: selectedCanteenId,
    canteen: CANTEENS.find((canteen) => canteen.id === selectedCanteenId)!.name,
    count: 1,
    price: firstDay.groups[1].items[0].price,
    inExchange: false,
    canCancel: false,
    canChangeAlternative: false,
    canChangeCanteen: false,
    alternatives: [],
    canteens: [],
  }] : [];
  const instagramMenus: InstagramDailyMenu[] = [];
  return {
    info: { balance: 23.4, name: "Demo Študent" },
    menu: {
      canteens: CANTEENS,
      selectedCanteenId,
      days,
      requestedDates,
      message: "",
      unavailable: false,
      canOrder: false,
    },
    orders,
    ordersStatus: "ready" as const,
    instagramMenus,
  };
}

export function demoStravaHistory(): StravaHistoryItem[] {
  const today = getBratislavaDateKey(new Date());
  let balance = 23.4;
  const items: StravaHistoryItem[] = [];
  for (let index = 0; index < 8; index++) {
    const date = addDays(today, -index * 3);
    const isTopUp = index === 5;
    const amount = isTopUp ? 30 : -(index % 2 ? 3.4 : 2.9);
    items.push({
      date: `${date}T${isTopUp ? "09:15" : "12:05"}:00`,
      movementTypeName: isTopUp ? "Vklad na účet" : "Výdaj jedla",
      reserve: 0,
      balance: Math.round(balance * 100) / 100,
      amount,
      destination: isTopUp ? "" : "Nová menza",
      source: isTopUp ? "Bankový prevod" : "",
      isMealOrder: !isTopUp,
    });
    balance -= amount;
  }
  return items;
}

export function demoDirectory(query: string): DirectoryPerson[] {
  const normalized = query.trim().toLocaleLowerCase("sk");
  if (normalized.length < 2) return [];
  const people = [...new Set(Object.values(COURSES).flat().map((course) => course.teacher))];
  return people
    .filter((name) => name.toLocaleLowerCase("sk").includes(normalized))
    .map((name, index) => ({
      name,
      job: "Katedra informatiky, FRI",
      room: ["RA313", "RB208", "RC105"][index % 3],
      phone: `+421 41 513 4${String(100 + index).padStart(3, "0")}`,
      email: `ucitel${index + 1}@fri.uniza.sk`,
    }));
}
