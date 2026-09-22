"use server";

import { getGrades, getScheduleData, getUserInfo } from "@/lib/scraper";
import { getStravaInfo } from "@/lib/strava";

export async function getHomePrimary() {
  const [user, schedule, stravaInfo, gradesData] = await Promise.all([
    getUserInfo().catch(() => null),
    getScheduleData().catch(() => ({ items: [], status: "error" as const })),
    getStravaInfo(false).catch(() => null),
    getGrades().catch(() => null),
  ]);
  return { user, schedule, stravaInfo, gradesData };
}
