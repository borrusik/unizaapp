import "server-only";

import { cookies } from "next/headers";
import { readCredentials } from "@/lib/credentials";

const BASE_URL = "https://strava.uniza.sk/WebKredit";
const REQUEST_TIMEOUT_MS = 15_000;

const sessionCookieOptions = {
  httpOnly: true,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
};

async function fetchStrava(input: string, init?: RequestInit) {
  return fetch(input, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function getCookiePairValue(cookiePair: string, expectedName: string): string | null {
  const separator = cookiePair.indexOf("=");
  if (separator <= 0 || cookiePair.slice(0, separator) !== expectedName) return null;
  return cookiePair.slice(separator + 1);
}

export async function authenticateStrava(
  username: string,
  password: string,
): Promise<string[] | null> {
  const initRes = await fetchStrava(`${BASE_URL}/`, { redirect: "manual" });
  if (!initRes.ok && initRes.status !== 302) return null;

  const initCookies = initRes.headers.getSetCookie?.() || [];
  let anete2 = "";
  for (const cookie of initCookies) {
    if (cookie.startsWith("Anete2=")) anete2 = cookie.split(";", 1)[0];
  }

  const res = await fetchStrava(`${BASE_URL}/Api/App/Login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(anete2 ? { Cookie: anete2 } : {}),
    },
    body: JSON.stringify({ userName: username, password, language: "sk" }),
  });

  if (!res.ok) return null;

  const sessionCookies: string[] = anete2 ? [anete2] : [];
  for (const cookie of res.headers.getSetCookie?.() || []) {
    if (!cookie.startsWith("AneteWebKredit2=") && !cookie.startsWith("Anete2=")) continue;
    const pair = cookie.split(";", 1)[0];
    const name = pair.slice(0, pair.indexOf("="));
    const existingIndex = sessionCookies.findIndex((item) => item.startsWith(`${name}=`));
    if (existingIndex >= 0) sessionCookies[existingIndex] = pair;
    else sessionCookies.push(pair);
  }

  const hasAnete2 = sessionCookies.some((item) => item.startsWith("Anete2="));
  const hasWebKredit = sessionCookies.some((item) => item.startsWith("AneteWebKredit2="));
  return hasAnete2 && hasWebKredit ? sessionCookies : null;
}

export async function storeStravaSession(sessionCookies: string[] | null): Promise<boolean> {
  if (!sessionCookies) return false;

  const anete2Pair = sessionCookies.find((item) => item.startsWith("Anete2="));
  const aneteWebPair = sessionCookies.find((item) => item.startsWith("AneteWebKredit2="));
  const anete2 = anete2Pair ? getCookiePairValue(anete2Pair, "Anete2") : null;
  const aneteWeb = aneteWebPair
    ? getCookiePairValue(aneteWebPair, "AneteWebKredit2")
    : null;

  if (!anete2 || !aneteWeb) return false;

  const cookieStore = await cookies();
  cookieStore.set("strava_anete2", anete2, sessionCookieOptions);
  cookieStore.set("strava_aneteweb", aneteWeb, sessionCookieOptions);
  return true;
}

export async function getStoredStravaSession(): Promise<string[] | null> {
  const cookieStore = await cookies();
  const anete2 = cookieStore.get("strava_anete2")?.value;
  const aneteWeb = cookieStore.get("strava_aneteweb")?.value;

  return anete2 && aneteWeb
    ? [`Anete2=${anete2}`, `AneteWebKredit2=${aneteWeb}`]
    : null;
}

export async function clearStravaSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("strava_anete2");
  cookieStore.delete("strava_aneteweb");
}

export async function restoreStravaSession(): Promise<string[] | null> {
  const credentials = await readCredentials();
  if (!credentials) return null;

  const session = await authenticateStrava(
    credentials.email.split("@")[0],
    credentials.password,
  ).catch(() => null);

  return (await storeStravaSession(session)) ? session : null;
}
