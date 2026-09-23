export type InstagramScrapedPost = {
  id: string;
  caption: string;
  permalink: string;
  timestamp: string;
  images: string[];
};

type InstagramImageCandidate = {
  url?: string;
};

type InstagramCarouselItem = {
  id?: string;
  image_versions2?: { candidates?: InstagramImageCandidate[] };
};

type InstagramXigMedia = InstagramCarouselItem & {
  pk?: string;
  media_type?: number;
  taken_at?: number;
  caption?: { text?: string };
  user?: { username?: string };
  carousel_media?: InstagramCarouselItem[];
};

type InstagramXigEnvelope = {
  if_not_gated_logged_out?: InstagramXigMedia;
  media_type?: number;
};

type InstagramTimelineConnection = {
  edges?: Array<{ node?: InstagramXigMedia }>;
};

const SHORTCODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function isBratislavaInstagramWatchWindow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Bratislava",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find(({ type }) => type === "hour")?.value ?? -1);
  const minute = Number(parts.find(({ type }) => type === "minute")?.value ?? -1);
  const minutes = hour * 60 + minute;
  return minutes >= 9 * 60 && minutes <= 13 * 60 + 30;
}

export function extractBalancedJson(source: string, start: number) {
  if (start < 0 || source[start] !== "{") return "";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return "";
}

function preferredImage(item: InstagramCarouselItem) {
  const candidates = item.image_versions2?.candidates ?? [];
  return candidates.find(({ url }) => /(?:p|s)1080x1080/.test(url ?? ""))?.url
    ?? candidates[0]?.url
    ?? "";
}

export function instagramShortcodeFromMediaId(mediaId: string) {
  if (!/^\d+$/.test(mediaId)) return "";
  let value = BigInt(mediaId);
  let shortcode = "";
  const base = BigInt(64);
  while (value > BigInt(0)) {
    shortcode = SHORTCODE_ALPHABET[Number(value % base)] + shortcode;
    value /= base;
  }
  return shortcode;
}

function toScrapedPost(media: InstagramXigMedia, permalink: string): InstagramScrapedPost | null {
  const items = media.carousel_media?.length ? media.carousel_media : [media];
  const images = [...new Set(items.map(preferredImage).filter((url) => url.startsWith("https://")))];
  if (!media.caption?.text || images.length === 0) return null;
  return {
    id: media.id ?? media.pk ?? permalink,
    caption: media.caption.text,
    permalink,
    timestamp: media.taken_at ? new Date(media.taken_at * 1000).toISOString() : "",
    images,
  };
}

export function parseInstagramBotHtml(
  html: string,
  permalink: string,
  expectedUsername: string,
): InstagramScrapedPost | null {
  const markerIndex = html.indexOf('"xig_polaris_media":');
  if (markerIndex < 0) return null;
  const jsonStart = html.indexOf("{", markerIndex);
  const raw = extractBalancedJson(html, jsonStart);
  if (!raw) return null;

  try {
    const envelope = JSON.parse(raw) as InstagramXigEnvelope;
    const media = envelope.if_not_gated_logged_out
      ?? (envelope.media_type ? envelope as InstagramXigMedia : null);
    if (!media || media.user?.username?.toLocaleLowerCase("en") !== expectedUsername.toLocaleLowerCase("en")) {
      return null;
    }

    return toScrapedPost(media, permalink);
  } catch {
    return null;
  }
}

export function parseInstagramProfileBotHtml(
  html: string,
  expectedUsername: string,
): InstagramScrapedPost[] {
  const profileMarker = html.indexOf('"xig_user_by_igid_v2":');
  if (profileMarker < 0) return [];
  const profileRaw = extractBalancedJson(html, html.indexOf("{", profileMarker));
  if (!profileRaw) return [];

  try {
    const profile = JSON.parse(profileRaw) as { username?: string };
    if (profile.username?.toLocaleLowerCase("en") !== expectedUsername.toLocaleLowerCase("en")) return [];

    const timelineMarker = html.indexOf('"polaris_timeline_connection":');
    if (timelineMarker < 0) return [];
    const timelineRaw = extractBalancedJson(html, html.indexOf("{", timelineMarker));
    if (!timelineRaw) return [];
    const timeline = JSON.parse(timelineRaw) as InstagramTimelineConnection;

    return (timeline.edges ?? []).flatMap(({ node }) => {
      const mediaId = node?.pk ?? node?.id?.replace(/^POLARIS_/, "") ?? "";
      const shortcode = instagramShortcodeFromMediaId(mediaId);
      if (!node || !shortcode) return [];
      const permalink = `https://www.instagram.com/p/${shortcode}/`;
      const post = toScrapedPost(node, permalink);
      return post ? [post] : [];
    });
  } catch {
    return [];
  }
}
