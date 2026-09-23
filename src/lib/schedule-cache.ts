import { createHash } from "node:crypto";
import { getCache } from "@vercel/functions";

import type { ScheduleData } from "@/lib/scraper";

const SCHEDULE_FRESH_MS = 24 * 60 * 60 * 1000;
const SCHEDULE_RETENTION_SECONDS = 7 * 24 * 60 * 60;

type ScheduleSnapshot = {
  data: ScheduleData;
  refreshedAt: number;
};

export type CachedSchedule = ScheduleSnapshot & {
  fresh: boolean;
};

function scheduleKey(group: string, academicYearStart: number) {
  const identity = `${group.trim().toLocaleUpperCase("sk")}|${academicYearStart}`;
  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 32);
  return `schedule-v1-${digest}`;
}

function isScheduleSnapshot(value: unknown): value is ScheduleSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ScheduleSnapshot>;
  return (
    typeof snapshot.refreshedAt === "number" &&
    Boolean(snapshot.data) &&
    Array.isArray(snapshot.data?.items) &&
    typeof snapshot.data?.status === "string"
  );
}

export async function readSharedSchedule(
  group: string,
  academicYearStart: number,
): Promise<CachedSchedule | null> {
  try {
    const value = await getCache({ namespace: "unizaapp" }).get(
      scheduleKey(group, academicYearStart),
    );
    if (!isScheduleSnapshot(value)) return null;
    return {
      ...value,
      fresh: Date.now() - value.refreshedAt < SCHEDULE_FRESH_MS,
    };
  } catch (error) {
    console.error("Shared schedule cache read failed:", error);
    return null;
  }
}

export async function writeSharedSchedule(
  group: string,
  academicYearStart: number,
  data: ScheduleData,
) {
  if (data.status !== "ready" && data.status !== "empty") return;
  try {
    await getCache({ namespace: "unizaapp" }).set(
      scheduleKey(group, academicYearStart),
      { data, refreshedAt: Date.now() } satisfies ScheduleSnapshot,
      {
        name: `Schedule ${academicYearStart}`,
        tags: ["uniza-schedules"],
        ttl: SCHEDULE_RETENTION_SECONDS,
      },
    );
  } catch (error) {
    // Cache availability must never make the authenticated timetable unusable.
    console.error("Shared schedule cache write failed:", error);
  }
}
