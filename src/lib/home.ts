"use server";

import { getGrades, getScheduleData, getUserInfo } from "@/lib/scraper";
import { getStravaInfo } from "@/lib/strava";

export async function getHomePrimary() {
  const [user, schedule] = await Promise.all([
    getUserInfo().catch(() => null),
    getScheduleData().catch(() => ({ items: [], status: "error" as const })),
  ]);
  return { user, schedule };
}

export async function getHomeStravaInfo() {
  return getStravaInfo(false).catch(() => null);
}

export async function getHomeGrades() {
  return getGrades().catch(() => null);
}
