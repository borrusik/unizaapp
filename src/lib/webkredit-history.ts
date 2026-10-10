export type StravaHistoryItem = {
  date: string;
  movementTypeName: string;
  reserve: number;
  balance: number;
  amount: number;
  destination: string;
  source: string;
  isMealOrder: boolean;
};

export function parseWebKreditHistory(payload: unknown): StravaHistoryItem[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { items?: unknown }).items)) throw new Error("WEBKREDIT_HISTORY_INVALID_RESPONSE");
  return (payload as { items: unknown[] }).items.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    if (item.isStartOrEnd === true) return [];
    const date = typeof item.time === "string" && Number.isFinite(Date.parse(item.time)) ? item.time : item.date;
    if (typeof date !== "string" || !Number.isFinite(Date.parse(date))) return [];
    const reserve = Number(item.reserve ?? 0), balance = Number(item.balance ?? 0);
    if (!Number.isFinite(reserve) || !Number.isFinite(balance)) throw new Error("WEBKREDIT_HISTORY_INVALID_AMOUNT");
    return [{ date, movementTypeName: String(item.movementTypeName || ""), reserve, balance, amount: Math.round((reserve + balance) * 100) / 100, destination: String(item.destination || ""), source: String(item.source || ""), isMealOrder: item.isMealOrder === true }];
  }).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}
