"use server";

import { getCache } from "@vercel/functions";
import { parseInstagramMenuCaption, type InstagramDailyMenu } from "@/lib/instagram-menu";

type InstagramMedia = {
  id: string;
  caption: string;
  permalink: string;
  timestamp: string;
  images: string[];
};

type InstagramGraphMedia = {
  id?: string;
  caption?: string;
  permalink?: string;
  timestamp?: string;
  media_url?: string;
  thumbnail_url?: string;
  children?: { data?: InstagramGraphMedia[] };
};

type InstagramWebNode = {
  id?: string;
  shortcode?: string;
  taken_at_timestamp?: number;
  display_url?: string;
  thumbnail_src?: string;
  edge_media_to_caption?: { edges?: Array<{ node?: { text?: string } }> };
  edge_sidecar_to_children?: { edges?: Array<{ node?: InstagramWebNode }> };
};

type MenuSnapshot = {
  menus: InstagramDailyMenu[];
  refreshedAt: number;
};

const PROFILE_URL = "https://www.instagram.com/menzazilina/";
const SNAPSHOT_KEY = "instagram-menzazilina-v2";
const ATTEMPT_KEY = "instagram-menzazilina-attempt-v1";
const SNAPSHOT_FRESH_MS = 30 * 60 * 1000;
const RETENTION_SECONDS = 7 * 24 * 60 * 60;
const MIN_ATTEMPT_SECONDS = 5 * 60;
let menuRequest: Promise<InstagramDailyMenu[]> | null = null;

function isSnapshot(value: unknown): value is MenuSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<MenuSnapshot>;
  return Array.isArray(snapshot.menus) && typeof snapshot.refreshedAt === "number";
}

function uniqueImages(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.startsWith("https://"))))];
}

function fromGraphMedia(media: InstagramGraphMedia): InstagramMedia | null {
  if (!media.id) return null;
  const childImages = media.children?.data?.flatMap((child) => [child.media_url, child.thumbnail_url]) ?? [];
  return {
    id: media.id,
    caption: media.caption ?? "",
    permalink: media.permalink ?? PROFILE_URL,
    timestamp: media.timestamp ?? "",
    images: uniqueImages([...childImages, media.media_url, media.thumbnail_url]),
  };
}

function fromWebNode(node: InstagramWebNode): InstagramMedia | null {
  if (!node.id) return null;
  const childImages = node.edge_sidecar_to_children?.edges?.flatMap(({ node: child }) => [
    child?.display_url,
    child?.thumbnail_src,
  ]) ?? [];
  return {
    id: node.id,
    caption: node.edge_media_to_caption?.edges?.[0]?.node?.text ?? "",
    permalink: node.shortcode ? `https://www.instagram.com/p/${node.shortcode}/` : PROFILE_URL,
    timestamp: node.taken_at_timestamp
      ? new Date(node.taken_at_timestamp * 1000).toISOString()
      : "",
    images: uniqueImages([...childImages, node.display_url, node.thumbnail_src]),
  };
}

function postDate(timestamp: string) {
  const date = timestamp ? new Date(timestamp) : new Date(Number.NaN);
  if (Number.isNaN(date.valueOf())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Bratislava",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toDailyMenu(media: InstagramMedia): InstagramDailyMenu | null {
  const parsed = parseInstagramMenuCaption(media.caption, media.permalink);
  if (parsed) return { ...parsed, images: media.images };
  const date = postDate(media.timestamp);
  if (!date || media.images.length === 0) return null;
  return { date, dayLabel: "", sections: [], permalink: media.permalink, images: media.images };
}

async function fetchOfficialFeed(accessToken: string): Promise<InstagramMedia[]> {
  const params = new URLSearchParams({
    fields: "id,caption,permalink,timestamp,media_url,thumbnail_url,children{media_url,thumbnail_url}",
    limit: "20",
    access_token: accessToken,
  });
  const response = await fetch(`https://graph.instagram.com/me/media?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`official feed returned ${response.status}`);
  const payload = await response.json() as { data?: InstagramGraphMedia[] };
  return (payload.data ?? []).map(fromGraphMedia).filter((item): item is InstagramMedia => item !== null);
}

async function fetchPublicFeed(): Promise<InstagramMedia[]> {
  // Instagram has no supported anonymous feed API. This deliberately isolated,
  // low-frequency fallback may be rate-limited or changed by Instagram.
  const response = await fetch(
    "https://www.instagram.com/api/v1/users/web_profile_info/?username=menzazilina",
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Referer: PROFILE_URL,
        "User-Agent": "Mozilla/5.0 (compatible; UNIZAStudent/1.0; +https://unizaapp.vercel.app)",
        "x-ig-app-id": "936619743392459",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error(`public feed returned ${response.status}`);
  const payload = await response.json() as {
    data?: { user?: { edge_owner_to_timeline_media?: { edges?: Array<{ node?: InstagramWebNode }> } } };
  };
  const edges = payload.data?.user?.edge_owner_to_timeline_media?.edges ?? [];
  return edges
    .map(({ node }) => node ? fromWebNode(node) : null)
    .filter((item): item is InstagramMedia => item !== null);
}

async function readSnapshot() {
  try {
    const value = await getCache({ namespace: "unizaapp" }).get(SNAPSHOT_KEY);
    return isSnapshot(value) ? value : null;
  } catch (error) {
    console.error("Instagram cache read failed:", error);
    return null;
  }
}

export async function getInstagramDailyMenus(force = false): Promise<InstagramDailyMenu[]> {
  const cache = getCache({ namespace: "unizaapp" });
  const snapshot = await readSnapshot();
  if (!force && snapshot && Date.now() - snapshot.refreshedAt < SNAPSHOT_FRESH_MS) {
    return snapshot.menus;
  }
  if (menuRequest) return menuRequest;

  const recentlyAttempted = await cache.get(ATTEMPT_KEY).catch(() => null);
  if (recentlyAttempted) return snapshot?.menus ?? [];

  const request = (async () => {
    await cache.set(ATTEMPT_KEY, Date.now(), { ttl: MIN_ATTEMPT_SECONDS, name: "Instagram refresh throttle" })
      .catch(() => undefined);
    try {
      const accessToken = process.env.MENZA_INSTAGRAM_ACCESS_TOKEN?.trim();
      const media = accessToken
        ? await fetchOfficialFeed(accessToken)
        : await fetchPublicFeed();
      const menus = media
        .map(toDailyMenu)
        .filter((menu): menu is InstagramDailyMenu => menu !== null)
        .toSorted((left, right) => right.date.localeCompare(left.date));
      if (menus.length === 0) throw new Error("feed did not contain usable posts");

      const nextSnapshot: MenuSnapshot = { menus, refreshedAt: Date.now() };
      await cache.set(SNAPSHOT_KEY, nextSnapshot, {
        name: "Menza Zilina Instagram menus",
        tags: ["instagram-menus"],
        ttl: RETENTION_SECONDS,
      });
      return menus;
    } catch (error) {
      console.error("Instagram refresh failed:", error);
      return snapshot?.menus ?? [];
    }
  })();

  menuRequest = request;
  try {
    return await request;
  } finally {
    if (menuRequest === request) menuRequest = null;
  }
}
