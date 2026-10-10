export type DirectoryPerson = { name: string; job: string; room: string; phone: string; email: string };

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

export function createDirectorySearch(fetchDirectory: (query: string) => Promise<unknown>) {
  const cache = new Map<string, { timestamp: number; data: DirectoryPerson[] }>();
  const requests = new Map<string, Promise<DirectoryPerson[]>>();
  return async function searchDirectory(query: string): Promise<DirectoryPerson[]> {
    const normalized = clean(query, 80);
    if (normalized.length < 2) return [];
    const key = normalized.toLocaleLowerCase("sk");
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < 5 * 60_000) return cached.data;
    const pending = requests.get(key);
    if (pending) return pending;
    const request = (async () => {
      const payload = await fetchDirectory(normalized);
      if (!payload || typeof payload !== "object" || !Array.isArray((payload as { directory?: unknown }).directory)) {
        throw new Error("UNIZA_DIRECTORY_INVALID_RESPONSE");
      }
      const data = (payload as { directory: unknown[] }).directory.slice(0, 20).map((entry) => {
        const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
        return { name: clean(item.name, 160), job: clean(item.job, 200), room: clean(item.room, 60), phone: clean(item.tel || item.mobil, 80), email: clean(item.mail, 160) };
      }).filter((person) => person.name);
      if (cache.size >= 200 && !cache.has(key)) cache.delete(cache.keys().next().value!);
      cache.set(key, { timestamp: Date.now(), data });
      return data;
    })();
    requests.set(key, request);
    try { return await request; } finally { if (requests.get(key) === request) requests.delete(key); }
  };
}
