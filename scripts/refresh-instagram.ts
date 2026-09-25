import { createPrivateKey, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseInstagramMenuCaption } from "../src/lib/instagram-menu.ts";
import { parseInstagramProfileBotHtml } from "../src/lib/instagram-scrape.ts";

const PROFILE_URL = "https://www.instagram.com/menzazilina/";
const REFRESH_URL = process.env.MENZA_REFRESH_URL?.trim()
  || "https://unizaapp.vercel.app/api/instagram/refresh";
const PRIVATE_KEY_PATH = process.env.MENZA_INGEST_PRIVATE_KEY_PATH?.trim()
  || resolve(".secrets/menza-ingest-private.pem");

const profileResponse = await fetch(PROFILE_URL, {
  headers: {
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
  },
  signal: AbortSignal.timeout(20_000),
});
if (!profileResponse.ok) throw new Error(`Instagram profile returned ${profileResponse.status}`);

const posts = parseInstagramProfileBotHtml(await profileResponse.text(), "menzazilina")
  .filter((post) => parseInstagramMenuCaption(post.caption, post.permalink) !== null)
  .slice(0, 3);
if (posts.length === 0) throw new Error("Instagram profile did not contain menu posts");

const rawBody = JSON.stringify({ posts });
const timestamp = String(Date.now());
const privateKey = createPrivateKey(await readFile(PRIVATE_KEY_PATH, "utf8"));
const signature = sign(
  null,
  Buffer.from(`${timestamp}.${rawBody}`),
  privateKey,
).toString("base64url");

const latest = posts[0];
const expectedMenu = parseInstagramMenuCaption(latest.caption, latest.permalink);
const statusUrl = new URL(REFRESH_URL);
statusUrl.searchParams.set("status", "1");
const statusResponse = await fetch(statusUrl, {
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(15_000),
});
if (statusResponse.ok) {
  const statusResult = await statusResponse.json() as Record<string, unknown>;
  if (
    statusResult.status === "checked"
    && statusResult.latestPermalink === latest.permalink
    && statusResult.latestDate === expectedMenu?.date
    && Number(statusResult.latestImageCount) === latest.images.length
    && Number(statusResult.menuCount) > 0
  ) {
    console.log(JSON.stringify({
      httpStatus: statusResponse.status,
      ...statusResult,
      cacheUpdated: false,
      expectedLatestDate: expectedMenu?.date ?? "",
      expectedLatestPermalink: latest.permalink,
      discoveredImages: latest.images.length,
    }));
    process.exit(0);
  }
}

const refreshResponse = await fetch(REFRESH_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-menza-signature": signature,
    "x-menza-timestamp": timestamp,
  },
  body: rawBody,
  signal: AbortSignal.timeout(30_000),
});
const responseText = await refreshResponse.text();
let result: Record<string, unknown> = {};
try {
  result = JSON.parse(responseText) as Record<string, unknown>;
} catch {
  throw new Error(`Production returned non-JSON response (${refreshResponse.status})`);
}

const validResult = refreshResponse.ok
  && result.status === "checked"
  && result.latestPermalink === latest.permalink
  && result.latestDate === expectedMenu?.date
  && Number(result.latestImageCount) === latest.images.length
  && Number(result.menuCount) > 0;
console.log(JSON.stringify({
  httpStatus: refreshResponse.status,
  ...result,
  expectedLatestDate: expectedMenu?.date ?? "",
  expectedLatestPermalink: latest.permalink,
  discoveredImages: latest.images.length,
}));
if (!validResult) process.exitCode = 1;
