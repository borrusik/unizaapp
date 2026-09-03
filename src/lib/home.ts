"use server";

import { getExamTermsForYear, getGrades, getSchedule, getSubjects, getUserInfo } from "@/lib/scraper";
import { getStravaInfo } from "@/lib/strava";

export async function getHomePrimary() {
  const [user, schedule] = await Promise.all([
    getUserInfo().catch(() => null),
    getSchedule().catch(() => []),
  ]);
  return { user, schedule };
}

export async function getHomeAcademic() {
  const [subjects, grades] = await Promise.all([
    getSubjects().catch(() => null),
    getGrades().catch(() => null),
  ]);
  return { subjects, grades };
}

export async function getHomeFood() {
  return getStravaInfo().catch(() => null);
}

export async function getHomeExams(academicYearStart: number) {
  return getExamTermsForYear(academicYearStart).catch(() => []);
}
