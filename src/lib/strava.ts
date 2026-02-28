"use server";

import { cookies } from "next/headers";

const BASE_URL = "https://strava.uniza.sk/WebKredit";

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

export async function loginStrava(username: string, password: string): Promise<string[] | null> {
  // Step 1: Get initial session cookie (Anete2)
  const initRes = await fetch(`${BASE_URL}/`, { cache: "no-store", redirect: "manual" });
  const initCookies = initRes.headers.getSetCookie?.() || [];
  let anete2 = "";
  for (const c of initCookies) {
    if (c.includes("Anete2")) anete2 = c.split(";")[0];
  }

  // Step 2: POST login
  const res = await fetch(`${BASE_URL}/Api/App/Login`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(anete2 ? { Cookie: anete2 } : {}),
    },
    body: JSON.stringify({ userName: username, password, language: "sk" }),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const setCookieHeaders = res.headers.getSetCookie?.() || [];
  const sessionCookies: string[] = anete2 ? [anete2] : [];

  for (const c of setCookieHeaders) {
    if (c.includes("AneteWebKredit2") || c.includes("Anete2")) {
      const cookieStr = c.split(";")[0];
      const existingIdx = sessionCookies.findIndex(sc => sc.split("=")[0] === cookieStr.split("=")[0]);
      if (existingIdx >= 0) sessionCookies[existingIdx] = cookieStr;
      else sessionCookies.push(cookieStr);
    }
  }

  return sessionCookies.length >= 2 ? sessionCookies : null;
}

export async function getStravaSession(forceRefresh = false): Promise<string[] | null> {
  const cookieStore = await cookies();
  const anete2 = cookieStore.get("strava_anete2")?.value;
  const aneteWeb = cookieStore.get("strava_aneteweb")?.value;

  if (!forceRefresh && anete2 && aneteWeb) {
    return [`Anete2=${anete2}`, `AneteWebKredit2=${aneteWeb}`];
  }

  // Clear existing if forcing refresh
  if (forceRefresh) {
    cookieStore.delete("strava_anete2");
    cookieStore.delete("strava_aneteweb");
  }

  // Try authenticating with stored uniza_pass and email (username)
  const email = cookieStore.get("uniza_email")?.value;
  const pass = cookieStore.get("uniza_pass")?.value;

  if (email && pass) {
    const username = email.split("@")[0];
    const newCookies = await loginStrava(username, pass);
    if (newCookies) {
      newCookies.forEach(c => {
        if (c.startsWith("Anete2=")) cookieStore.set("strava_anete2", c.split("=")[1], { httpOnly: true, path: "/" });
        if (c.startsWith("AneteWebKredit2=")) cookieStore.set("strava_aneteweb", c.split("=")[1], { httpOnly: true, path: "/" });
      });
      return newCookies;
    }
  }

  return null;
}

export type StravaInfo = {
  balance: number;
  name: string;
};

export async function getStravaInfo(): Promise<StravaInfo | null> {
  let sessionCookies = await getStravaSession();
  if (!sessionCookies) return null;

  const cacheKey = sessionCookies.join(";") + "_info";
  const cached = getCached<StravaInfo>(cacheKey);
  if (cached) return cached;

  try {
    let res = await fetch(`${BASE_URL}/`, {
      headers: { Cookie: sessionCookies.join("; ") },
      cache: "no-store",
    });

    let html = await res.text();
    let modelMatch = html.match(/window\.wkIndexModel\s*=\s*({[\s\S]*?});/);

    // If the wkIndexModel is not available, the session might be expired. Log in again.
    if (!modelMatch) {
      sessionCookies = await getStravaSession(true); // force refresh
      if (!sessionCookies) return null;

      res = await fetch(`${BASE_URL}/`, {
        headers: { Cookie: sessionCookies.join("; ") },
        cache: "no-store",
      });
      html = await res.text();
      modelMatch = html.match(/window\.wkIndexModel\s*=\s*({[\s\S]*?});/);
    }

    if (!modelMatch) return null;

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
  let sessionCookies = await getStravaSession();
  if (!sessionCookies) return [];

  const cacheKey = sessionCookies.join(";") + "_history";
  const cached = getCached<StravaHistoryItem[]>(cacheKey);
  if (cached) return cached;

  // Get last 30 days history
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);

  const fromStr = from.toISOString();
  const toStr = to.toISOString();

  try {
    let res = await fetch(`${BASE_URL}/Api/History/History?DateFrom=${encodeURIComponent(fromStr)}&DateTo=${encodeURIComponent(toStr)}`, {
      headers: { Cookie: sessionCookies.join("; ") },
      cache: "no-store",
    });

    // Handle 401 Unauthorized by recreating the session
    if (res.status === 401 || !res.ok) {
      sessionCookies = await getStravaSession(true);
      if (!sessionCookies) return [];

      res = await fetch(`${BASE_URL}/Api/History/History?DateFrom=${encodeURIComponent(fromStr)}&DateTo=${encodeURIComponent(toStr)}`, {
        headers: { Cookie: sessionCookies.join("; ") },
        cache: "no-store",
      });
    }

    if (!res.ok) return [];

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
  let sessionCookies = await getStravaSession();
  if (!sessionCookies) return [];

  const cacheKey = sessionCookies.join(";") + "_menu";
  const cached = getCached<MenuItem[]>(cacheKey);
  if (cached) return cached;

  // Get current date exactly at midnight local time to avoid timezone issues
  const today = new Date();
  today.setHours(12, 0, 0, 0); // Midday to be safe
  const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

  try {
    let res = await fetch(`${BASE_URL}/Api/Ordering/Menu?Dates=${dateStr}T00:00:00.000Z&CanteenId=1`, {
      headers: { Cookie: sessionCookies.join("; ") },
      cache: "no-store",
    });

    if (res.status === 401 || !res.ok) {
      sessionCookies = await getStravaSession(true);
      if (!sessionCookies) return [];

      res = await fetch(`${BASE_URL}/Api/Ordering/Menu?Dates=${dateStr}T00:00:00.000Z&CanteenId=1`, {
        headers: { Cookie: sessionCookies.join("; ") },
        cache: "no-store",
      });
    }

    if (!res.ok) return [];

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

    // If we couldn't parse it that way, use fallback mock logic or investigate structure
    setCached(cacheKey, items);
    return items;
  } catch (e) {
    console.error("Failed to fetch Strava menu:", e);
    return [];
  }
}
