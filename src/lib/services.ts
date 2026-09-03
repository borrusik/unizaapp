"use server";

const DIRECTORY_URL = "https://nic.uniza.sk/webservices/getDirectory.php";
const cache = new Map<string, { timestamp: number; data: DirectoryPerson[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export type DirectoryPerson = {
  name: string;
  job: string;
  room: string;
  phone: string;
  email: string;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

export async function searchUnizaDirectory(query: string): Promise<DirectoryPerson[]> {
  const normalized = clean(query, 80);
  if (normalized.length < 2) return [];
  const key = normalized.toLocaleLowerCase("sk");
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.data;

  try {
    const params = new URLSearchParams({ q: normalized, m: "", w: "", f: "" });
    const response = await fetch(`${DIRECTORY_URL}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json" } });
    if (!response.ok) return [];
    const payload = await response.json() as { directory?: unknown[] };
    const data = (Array.isArray(payload.directory) ? payload.directory : []).slice(0, 20).map((entry) => {
      const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
      return { name: clean(item.name, 160), job: clean(item.job, 200), room: clean(item.room, 60), phone: clean(item.tel || item.mobil, 80), email: clean(item.mail, 160) };
    }).filter((person) => person.name);
    if (cache.size > 200) cache.clear();
    cache.set(key, { timestamp: Date.now(), data });
    return data;
  } catch {
    return [];
  }
}
