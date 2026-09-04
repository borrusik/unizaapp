"use server";

import { getScheduleData, getUserInfo } from "@/lib/scraper";

export async function getHomePrimary() {
  const [user, schedule] = await Promise.all([
    getUserInfo().catch(() => null),
    getScheduleData().catch(() => ({ items: [], status: "error" as const })),
  ]);
  return { user, schedule };
}
