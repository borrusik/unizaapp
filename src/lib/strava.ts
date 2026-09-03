"use server";

import { createHash } from "node:crypto";
import { clearStravaSession, getStoredStravaSession, restoreStravaSession } from "@/lib/strava-session";
import {
  getBratislavaDateKey,
  listDateKeys,
  localDateToUtcIso,
  parseWebKreditCanteens,
  parseWebKreditMenu,
  parseWebKreditOperation,
  parseWebKreditOrders,
  type Canteen,
  type IntegrationOperationResult,
  type MenuDay,
  type WebKreditOrder,
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

function clearSessionCache(sessionCookies: string[]) {
  const digest = createHash("sha256").update(sessionCookies.join(";")).digest("hex");
  for (const key of STRAVA_CACHE.keys()) {
    if (key.startsWith(`${digest}_`) || key.startsWith("public_menu_")) STRAVA_CACHE.delete(key);
  }
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
  canOrder: boolean;
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
  const sessionCookies = await getStravaSession();
  const cacheKey = sessionCookies
    ? sessionCacheKey(sessionCookies, `menu_${safeCanteenId}_${safeDates.join("_")}`)
    : `public_menu_${safeCanteenId}_${safeDates.join("_")}`;
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
    const authHeaders: Record<string, string> = sessionCookies
      ? { Cookie: sessionCookies.join("; ") }
      : {};
    const [menuResponse, orderingResponse] = await Promise.all([
      fetchStrava(`${BASE_URL}/Api/Ordering/Menu?${menuParams.toString()}`, {
        headers: { Accept: "application/json", ...authHeaders },
      }),
      fetchStrava(`${BASE_URL}/Api/Ordering/Ordering?${orderingParams.toString()}`, {
        headers: { Accept: "application/json", ...authHeaders },
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
      canOrder: Boolean(sessionCookies) && ordering.canOrder,
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
      canOrder: false,
    };
  }
}

export async function getStravaOrders(
  startDate?: string,
  endDate?: string,
  force = false,
): Promise<WebKreditOrder[]> {
  const sessionCookies = await getStravaSession();
  if (!sessionCookies) return [];
  const today = getBratislavaDateKey(new Date());
  const range = listDateKeys(startDate || today, 14);
  const from = localDateToUtcIso(range[0] || today);
  const to = localDateToUtcIso(endDate || range.at(-1) || today);
  if (!from || !to) return [];
  const cacheKey = sessionCacheKey(sessionCookies, `orders_${from}_${to}`);
  const cached = getCached<WebKreditOrder[]>(cacheKey);
  if (!force && cached) return cached;

  try {
    const params = new URLSearchParams({ ShowGrouped: "false", DateFrom: from, DateTo: to });
    const response = await fetchStrava(`${BASE_URL}/Api/Ordering/Orders?${params}`, {
      headers: { Accept: "application/json", Cookie: sessionCookies.join("; ") },
    });
    if (!response.ok) throw new Error(`Orders returned ${response.status}`);
    const orders = parseWebKreditOrders(await response.json());
    setCached(cacheKey, orders);
    return orders;
  } catch (error) {
    console.error("Failed to fetch WebKredit orders:", error instanceof Error ? error.message : "unknown");
    return [];
  }
}

type CompositeSelection = { id: number; amount: number };
export type PlaceStravaOrderInput = {
  date: string;
  mealKindId: number;
  alternative: number;
  canteenId: number;
  composites?: CompositeSelection[];
};

export type ChangeStravaOrderInput = {
  id: string;
  alternative: number;
  canteenId: number;
};

const operationLocks = new Map<string, number>();

function operationResult<T>(
  status: IntegrationOperationResult<T>["status"],
  code: string,
  message: string,
  confirmedState?: T,
): IntegrationOperationResult<T> {
  return { status, code, message, confirmedState, checkedAt: new Date().toISOString() };
}

async function withOperationLock<T>(
  key: string,
  operation: () => Promise<IntegrationOperationResult<T>>,
): Promise<IntegrationOperationResult<T>> {
  const now = Date.now();
  const lockedUntil = operationLocks.get(key) || 0;
  if (lockedUntil > now) return operationResult("rejected", "already_processing", "Operácia sa už spracúva.");
  if (operationLocks.size > 500) operationLocks.clear();
  operationLocks.set(key, now + 30_000);
  try {
    return await operation();
  } finally {
    operationLocks.delete(key);
  }
}

function webKreditActionsEnabled() {
  return process.env.ENABLE_WEBKREDIT_ACTIONS === "true";
}

function validOrderInput(input: PlaceStravaOrderInput) {
  return /^\d{4}-\d{2}-\d{2}$/.test(input.date) &&
    Number.isInteger(input.mealKindId) && input.mealKindId > 0 && input.mealKindId < 10_000 &&
    Number.isInteger(input.alternative) && input.alternative >= 0 && input.alternative < 10_000 &&
    Number.isInteger(input.canteenId) && input.canteenId > 0 && input.canteenId < 1_000 &&
    (input.composites || []).every((item) => Number.isInteger(item.id) && item.id > 0 && Number.isInteger(item.amount) && item.amount >= 0 && item.amount <= 5_000);
}

export async function placeStravaOrder(
  input: PlaceStravaOrderInput,
): Promise<IntegrationOperationResult<WebKreditOrder>> {
  if (!webKreditActionsEnabled()) return operationResult("disabled", "actions_disabled", "Objednávanie je dočasne vypnuté.");
  if (!validOrderInput(input)) return operationResult("rejected", "invalid_input", "Neplatné údaje objednávky.");

  const sessionCookies = await getStravaSession();
  if (!sessionCookies) return operationResult("rejected", "not_authenticated", "WebKredit nie je pripojený.");
  const lockKey = sessionCacheKey(sessionCookies, `place_${input.date}_${input.mealKindId}_${input.alternative}_${input.canteenId}`);
  return withOperationLock(lockKey, async () => {
    const menu = await getStravaMenu(input.canteenId, input.date, true);
    const item = menu.days.flatMap((day) => day.groups.flatMap((group) => group.items)).find((candidate) =>
      candidate.date === input.date && candidate.mealKindId === input.mealKindId && candidate.alternative === input.alternative && candidate.canteenId === input.canteenId,
    );
    if (!menu.canOrder || !item?.canOrder) return operationResult("rejected", "ordering_unavailable", "Toto jedlo sa teraz nedá objednať.");

    const composites = input.composites || [];
    if (item.composites.length > 0) {
      const allowed = new Set(item.composites.map((entry) => entry.id));
      const total = composites.reduce((sum, entry) => sum + entry.amount, 0);
      if (composites.some((entry) => !allowed.has(entry.id)) || total <= 0 || (item.compositeMaxWeight !== null && total > item.compositeMaxWeight)) {
        return operationResult("rejected", "invalid_composites", "Skontrolujte zloženie a hmotnosť jedla.");
      }
    }

    const params = new URLSearchParams({ CanteenId: input.canteenId.toString() });
    const date = localDateToUtcIso(input.date);
    if (!date) return operationResult("rejected", "invalid_date", "Neplatný dátum objednávky.");
    params.append("Dates", date);
    try {
      const response = await fetchStrava(`${BASE_URL}/Api/Ordering/Menu?${params}`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", Cookie: sessionCookies.join("; ") },
        body: JSON.stringify([{ date, mealKindId: input.mealKindId, alternative: input.alternative, canteenId: input.canteenId, fromExchange: false, count: 1, ...(composites.length ? { composites } : {}) }]),
      });
      if (!response.ok) return operationResult("uncertain", `http_${response.status}`, "Výsledok objednávky sa nepodarilo potvrdiť.");
      const parsed = parseWebKreditOperation(await response.json());
      if (!parsed.successful) return operationResult("rejected", parsed.code, "WebKredit objednávku odmietol.");
      clearSessionCache(sessionCookies);
      const confirmed = (await getStravaOrders(input.date, input.date, true)).find((order) =>
        order.date === input.date && order.mealKindId === input.mealKindId && order.alternative === input.alternative && order.canteenId === input.canteenId,
      );
      return confirmed
        ? operationResult("success", "success", "Objednávka bola potvrdená.", confirmed)
        : operationResult("uncertain", "not_confirmed", "WebKredit odpovedal úspešne, ale objednávka sa ešte nezobrazuje.");
    } catch {
      return operationResult("uncertain", "network_error", "Spojenie sa prerušilo. Objednávku pred opakovaním skontrolujte.");
    }
  });
}

export async function changeStravaOrder(
  input: ChangeStravaOrderInput,
): Promise<IntegrationOperationResult<WebKreditOrder>> {
  if (!webKreditActionsEnabled()) return operationResult("disabled", "actions_disabled", "Zmeny objednávok sú dočasne vypnuté.");
  if (!/^\d+$/.test(input.id) || !Number.isInteger(input.alternative) || !Number.isInteger(input.canteenId)) {
    return operationResult("rejected", "invalid_input", "Neplatná zmena objednávky.");
  }
  const sessionCookies = await getStravaSession();
  if (!sessionCookies) return operationResult("rejected", "not_authenticated", "WebKredit nie je pripojený.");
  return withOperationLock(sessionCacheKey(sessionCookies, `change_${input.id}`), async () => {
    const current = (await getStravaOrders(undefined, undefined, true)).find((order) => order.id === input.id);
    if (!current) return operationResult("rejected", "order_not_found", "Objednávka už neexistuje.");
    const changesAlternative = input.alternative !== current.alternative;
    const changesCanteen = input.canteenId !== current.canteenId;
    if ((changesAlternative && !current.canChangeAlternative) || (changesCanteen && !current.canChangeCanteen)) {
      return operationResult("rejected", "change_not_allowed", "Túto objednávku už nemožno zmeniť.");
    }
    try {
      const response = await fetchStrava(`${BASE_URL}/Api/Ordering/Orders?ShowGrouped=false`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", Cookie: sessionCookies.join("; ") },
        body: JSON.stringify([{ id: current.id, date: localDateToUtcIso(current.date), alternative: input.alternative, canteenId: input.canteenId, cancel: false, isGroup: false }]),
      });
      if (!response.ok) return operationResult("uncertain", `http_${response.status}`, "Výsledok zmeny sa nepodarilo potvrdiť.");
      const parsed = parseWebKreditOperation(await response.json());
      if (!parsed.successful) return operationResult("rejected", parsed.code, "WebKredit zmenu odmietol.");
      clearSessionCache(sessionCookies);
      const confirmed = (await getStravaOrders(undefined, undefined, true)).find((order) => order.id === current.id);
      return confirmed?.alternative === input.alternative && confirmed.canteenId === input.canteenId
        ? operationResult("success", "success", "Objednávka bola zmenená.", confirmed)
        : operationResult("uncertain", "not_confirmed", "Zmenu sa zatiaľ nepodarilo potvrdiť.");
    } catch {
      return operationResult("uncertain", "network_error", "Výsledok zmeny sa nepodarilo potvrdiť.");
    }
  });
}

export async function cancelStravaOrder(
  orderId: string,
): Promise<IntegrationOperationResult<null>> {
  if (!webKreditActionsEnabled()) return operationResult("disabled", "actions_disabled", "Rušenie objednávok je dočasne vypnuté.");
  if (!/^\d+$/.test(orderId)) return operationResult("rejected", "invalid_input", "Neplatná objednávka.");
  const sessionCookies = await getStravaSession();
  if (!sessionCookies) return operationResult("rejected", "not_authenticated", "WebKredit nie je pripojený.");
  return withOperationLock(sessionCacheKey(sessionCookies, `cancel_${orderId}`), async () => {
    const current = (await getStravaOrders(undefined, undefined, true)).find((order) => order.id === orderId);
    if (!current) return operationResult("success", "already_cancelled", "Objednávka už nie je aktívna.", null);
    if (!current.canCancel) return operationResult("rejected", "cancel_not_allowed", "Túto objednávku už nemožno zrušiť.");
    try {
      const response = await fetchStrava(`${BASE_URL}/Api/Ordering/Orders?ShowGrouped=false`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", Cookie: sessionCookies.join("; ") },
        body: JSON.stringify([{ id: current.id, date: localDateToUtcIso(current.date), alternative: current.alternative ?? 0, canteenId: current.canteenId, cancel: true, isGroup: false }]),
      });
      if (!response.ok) return operationResult("uncertain", `http_${response.status}`, "Výsledok zrušenia sa nepodarilo potvrdiť.");
      const parsed = parseWebKreditOperation(await response.json());
      if (!parsed.successful) return operationResult("rejected", parsed.code, "WebKredit zrušenie odmietol.");
      clearSessionCache(sessionCookies);
      const stillExists = (await getStravaOrders(undefined, undefined, true)).some((order) => order.id === orderId);
      return stillExists
        ? operationResult("uncertain", "not_confirmed", "Zrušenie sa zatiaľ nepodarilo potvrdiť.")
        : operationResult("success", "success", "Objednávka bola zrušená.", null);
    } catch {
      return operationResult("uncertain", "network_error", "Výsledok zrušenia sa nepodarilo potvrdiť.");
    }
  });
}
