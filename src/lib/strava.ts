"use server";

import { createHash } from "node:crypto";
import { clearStravaSession, getStoredStravaSession, restoreStravaSession } from "@/lib/strava-session";

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

export async function getStravaInfo(): Promise<StravaInfo | null> {
  const sessionCookies = await getStravaSession();
  if (!sessionCookies) return null;

  const cacheKey = sessionCacheKey(sessionCookies, "info");
  const cached = getCached<StravaInfo>(cacheKey);
  if (cached) return cached;

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

export async function getStravaHistory(): Promise<StravaHistoryItem[]> {
  const sessionCookies = await getStravaSession();
  if (!sessionCookies) return [];

  const cacheKey = sessionCacheKey(sessionCookies, "history");
  const cached = getCached<StravaHistoryItem[]>(cacheKey);
  if (cached) return cached;

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

export type MenuItem = {
  id: string;
  mealName: string;
  price: string;
  allergens: string;
};

export async function getStravaMenu(): Promise<MenuItem[]> {
  const sessionCookies = await getStravaSession();
  if (!sessionCookies) return [];

  const cacheKey = sessionCacheKey(sessionCookies, "menu");
  const cached = getCached<MenuItem[]>(cacheKey);
  if (cached) return cached;

  // Get current date exactly at midnight local time to avoid timezone issues
  const today = new Date();
  today.setHours(12, 0, 0, 0); // Midday to be safe
  const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

  try {
    const res = await fetchStrava(`${BASE_URL}/Api/Ordering/Menu?Dates=${dateStr}T00:00:00.000Z&CanteenId=1`, {
      headers: { Cookie: sessionCookies.join("; ") },
    });

    if (!res.ok) {
      await clearStravaSession();
      return [];
    }

    const data = await res.json();
    const items: MenuItem[] = [];

    // The API might return an array of dates containing meals
    if (Array.isArray(data) && data.length > 0 && data[0].groups) {
      for (const group of data[0].groups) {
        if (group.rows) {
          for (const row of group.rows) {
            if (row.item) {
              items.push({
                id: row.item.id?.toString() || Math.random().toString(),
                mealName: row.item.mealName || row.item.name || "Neznáme jedlo",
                price: row.item.priceWithCurrency || (row.item.price ? `${row.item.price.toFixed(2)} €` : "—"),
                allergens: row.item.allergens?.join(", ") || "",
              });
            }
          }
        }
      }
    }

    // Unknown or empty upstream structures are returned as an honest empty menu.
    setCached(cacheKey, items);
    return items;
  } catch (e) {
    console.error("Failed to fetch Strava menu:", e);
    return [];
  }
}
