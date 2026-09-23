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

    const items = media.carousel_media?.length ? media.carousel_media : [media];
    const images = [...new Set(items.map(preferredImage).filter((url) => url.startsWith("https://")))];
    if (!media.caption?.text || images.length === 0) return null;

    return {
      id: media.id ?? permalink,
      caption: media.caption.text,
      permalink,
      timestamp: media.taken_at ? new Date(media.taken_at * 1000).toISOString() : "",
      images,
    };
  } catch {
    return null;
  }
}
