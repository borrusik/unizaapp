"use server";

import { getGrades, getIntegrationStatus, getUserInfo } from "@/lib/scraper";

/** Keep profile loading to one browser request while retaining server parallelism. */
export async function getProfileDashboard(force = false) {
  const [user, grades, integration] = await Promise.all([
    getUserInfo(undefined, undefined, force),
    getGrades(undefined, force).catch(() => ({ winter: [], summer: [] })),
    getIntegrationStatus(),
  ]);

  return { user, grades, integration };
}
