"use server";

import { createHash } from "node:crypto";
import { clearStravaSession, getStoredStravaSession, restoreStravaSession } from "@/lib/strava-session";
import {
  getBratislavaDateKey,
  listDateKeys,
  localDateToUtcIso,
  parseWebKreditCanteens,
  parseWebKreditMenu,
  type Canteen,
  type MenuDay,
} from "@/lib/uniza-parsers";

const BASE_URL = "https://strava.uniza.sk/WebKredit";
const REQUEST_TIMEOUT_MS = 15_000;

const STRAVA_CACHE = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const cached = STRAVA_CACHE.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.data as T;
  return null;
}

function setCached(key: string, data: unknown) {
  if (STRAVA_CACHE.size > 500) STRAVA_CACHE.clear();
  STRAVA_CACHE.set(key, { data, timestamp: Date.now() });
}

async function fetchStrava(input: string, init?: RequestInit) {
  return fetch(input, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function sessionCacheKey(sessionCookies: string[], suffix: string): string {
  const digest = createHash("sha256").update(sessionCookies.join(";")).digest("hex");
  return `${digest}_${suffix}`;
}

async function getStravaSession(): Promise<string[] | null> {
  return (await getStoredStravaSession()) || restoreStravaSession();
}

export type StravaInfo = {
  balance: number;
  name: string;
};

export async function getStravaInfo(force = false): Promise<StravaInfo | null> {
  const sessionCookies = await getStravaSession();
  if (!sessionCookies) return null;

  const cacheKey = sessionCacheKey(sessionCookies, "info");
  const cached = getCached<StravaInfo>(cacheKey);
  if (!force && cached) return cached;

  try {
    const res = await fetchStrava(`${BASE_URL}/`, {
      headers: { Cookie: sessionCookies.join("; ") },
    });

    if (!res.ok) {
      await clearStravaSession();
      return null;
    }
    const html = await res.text();
    const modelMatch = html.match(/window\.wkIndexModel\s*=\s*({[\s\S]*?});/);

    if (!modelMatch) {
      await clearStravaSession();
      return null;
    }

    const modelData = JSON.parse(modelMatch[1]);
    const balance = modelData?.model?.balance?.balance || 0;
    const name = modelData?.model?.user?.name || modelData?.model?.user?.fullName || "Študent";

    const result = { balance, name };
    setCached(cacheKey, result);
    return result;
  } catch {
    console.error("Failed to parse Strava info:");
    return null;
  }
}

export type StravaHistoryItem = {
  date: string;
  movementTypeName: string;
  reserve: number;
  balance: number;
  destination: string;
  source: string;
  isMealOrder: boolean;
};

export async function getStravaHistory(force = false): Promise<StravaHistoryItem[]> {
  const sessionCookies = await getStravaSession();
  if (!sessionCookies) return [];

  const cacheKey = sessionCacheKey(sessionCookies, "history");
  const cached = getCached<StravaHistoryItem[]>(cacheKey);
  if (!force && cached) return cached;

  // Get last 30 days history
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);

  const fromStr = from.toISOString();
  const toStr = to.toISOString();

  try {
    const res = await fetchStrava(`${BASE_URL}/Api/History/History?DateFrom=${encodeURIComponent(fromStr)}&DateTo=${encodeURIComponent(toStr)}`, {
      headers: { Cookie: sessionCookies.join("; ") },
    });

    if (!res.ok) {
      await clearStravaSession();
      return [];
    }

    const data = await res.json();
    const items = data.items || [];
    setCached(cacheKey, items);
    return items;
  } catch (e) {
    console.error("Failed to fetch Strava history:", e);
    return [];
  }
}

export type StravaMenuResult = {
  canteens: Canteen[];
  selectedCanteenId: number;
  days: MenuDay[];
  requestedDates: string[];
  message: string;
  unavailable: boolean;
};

export async function getStravaMenu(
  canteenId = 1,
  startDate?: string,
  force = false,
): Promise<StravaMenuResult> {
  const safeCanteenId = Number.isInteger(canteenId) && canteenId > 0 && canteenId < 1_000
    ? canteenId
    : 1;
  const today = getBratislavaDateKey(new Date());
  const requestedDates = listDateKeys(startDate || today, 5);
  const safeDates = requestedDates.length > 0 ? requestedDates : listDateKeys(today, 5);
  const cacheKey = `public_menu_${safeCanteenId}_${safeDates.join("_")}`;
  const cached = getCached<StravaMenuResult>(cacheKey);
  if (!force && cached) return cached;

  const dateParams = safeDates
    .map(localDateToUtcIso)
    .filter((date): date is string => Boolean(date));
  const menuParams = new URLSearchParams({ CanteenId: safeCanteenId.toString() });
  for (const date of dateParams) menuParams.append("Dates", date);
  const orderingParams = new URLSearchParams({
    DateFrom: dateParams[0] || new Date().toISOString(),
    DateTo: dateParams.at(-1) || new Date().toISOString(),
  });

  try {
    const [menuResponse, orderingResponse] = await Promise.all([
      fetchStrava(`${BASE_URL}/Api/Ordering/Menu?${menuParams.toString()}`, {
        headers: { Accept: "application/json" },
      }),
      fetchStrava(`${BASE_URL}/Api/Ordering/Ordering?${orderingParams.toString()}`, {
        headers: { Accept: "application/json" },
      }),
    ]);
    if (!menuResponse.ok) throw new Error(`Menu returned ${menuResponse.status}`);

    const [menuPayload, orderingPayload] = await Promise.all([
      menuResponse.json(),
      orderingResponse.ok ? orderingResponse.json() : Promise.resolve(null),
    ]);
    const ordering = parseWebKreditCanteens(orderingPayload);
    const result: StravaMenuResult = {
      canteens: ordering.canteens,
      selectedCanteenId: ordering.canteens.some((canteen) => canteen.id === safeCanteenId)
        ? safeCanteenId
        : ordering.selectedCanteenId,
      days: parseWebKreditMenu(menuPayload),
      requestedDates: safeDates,
      message: ordering.message,
      unavailable: false,
    };

    setCached(cacheKey, result);
    return result;
  } catch (e) {
    console.error("Failed to fetch Strava menu:", e);
    return {
      canteens: [],
      selectedCanteenId: safeCanteenId,
      days: [],
      requestedDates: safeDates,
      message: "",
      unavailable: true,
    };
  }
}
