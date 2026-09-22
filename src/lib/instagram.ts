"use server";

import { parseInstagramMenuCaption, type InstagramDailyMenu } from "@/lib/instagram-menu";

type InstagramMedia = {
  id?: string;
  caption?: string;
  permalink?: string;
  timestamp?: string;
};

type InstagramMediaResponse = {
  data?: InstagramMedia[];
};

const INSTAGRAM_CACHE_TTL_MS = 15 * 60 * 1000;
let menuCache: { data: InstagramDailyMenu[]; timestamp: number } | null = null;
let menuRequest: Promise<InstagramDailyMenu[]> | null = null;

/**
 * Uses the official Instagram API token for @menzazilina when configured.
 * Public profile HTML does not contain a stable post feed and must not be
 * scraped through Instagram's private, rate-limited web GraphQL endpoints.
 */
export async function getInstagramDailyMenus(force = false): Promise<InstagramDailyMenu[]> {
  const accessToken = process.env.MENZA_INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!accessToken) return [];

  if (!force && menuCache && Date.now() - menuCache.timestamp < INSTAGRAM_CACHE_TTL_MS) {
    return menuCache.data;
  }
  if (!force && menuRequest) return menuRequest;

  const request = (async () => {
    try {
      const params = new URLSearchParams({
        fields: "id,caption,permalink,timestamp",
        limit: "20",
        access_token: accessToken,
      });
      const response = await fetch(`https://graph.instagram.com/me/media?${params}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return menuCache?.data ?? [];

      const payload = await response.json() as InstagramMediaResponse;
      const menus = (payload.data ?? [])
        .map((media) => parseInstagramMenuCaption(media.caption ?? "", media.permalink ?? ""))
        .filter((menu): menu is InstagramDailyMenu => menu !== null)
        .toSorted((left, right) => right.date.localeCompare(left.date));
      menuCache = { data: menus, timestamp: Date.now() };
      return menus;
    } catch {
      return menuCache?.data ?? [];
    }
  })();

  menuRequest = request;
  try {
    return await request;
  } finally {
    if (menuRequest === request) menuRequest = null;
  }
}
