"use server";

import { createDirectorySearch, type DirectoryPerson } from "@/lib/directory-search";
export type { DirectoryPerson } from "@/lib/directory-search";

const searchDirectory = createDirectorySearch(async (query) => {
  const params = new URLSearchParams({ q: query, m: "", w: "", f: "" });
  const response = await fetch(`https://nic.uniza.sk/webservices/getDirectory.php?${params}`, { cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`UNIZA_DIRECTORY_HTTP_${response.status}`);
  return response.json();
});

export async function searchUnizaDirectory(query: string): Promise<DirectoryPerson[]> {
  return searchDirectory(query);
}
