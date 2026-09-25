import { type NextRequest, NextResponse } from "next/server";
import { createPublicKey, verify } from "node:crypto";
import {
  ingestInstagramDailyMenus,
  readInstagramDailyMenuSnapshot,
  refreshInstagramDailyMenus,
  type InstagramIngestPost,
} from "@/lib/instagram";
import { isBratislavaInstagramWatchWindow } from "@/lib/instagram-scrape";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_SIGNED_BODY_BYTES = 200_000;
const SIGNATURE_MAX_AGE_MS = 5 * 60_000;
const MENZA_INGEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA8lwVVj5dACW6yNsfNwOjCAPFbOmEZuswYo7FV2IziaU=
-----END PUBLIC KEY-----`;

function reportResponse(report: Awaited<ReturnType<typeof refreshInstagramDailyMenus>>) {
  if (report.error) {
    return NextResponse.json(
      {
        status: "failed",
        menuCount: report.menus.length,
        latestDate: report.latestDate,
        latestPermalink: report.latestPermalink,
        error: report.error,
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      status: "checked",
      menuCount: report.menus.length,
      cacheUpdated: report.cacheUpdated,
      latestDate: report.latestDate,
      latestPermalink: report.latestPermalink,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  if (!isBratislavaInstagramWatchWindow()) {
    return NextResponse.json(
      { status: "outside_watch_window" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (request.nextUrl.searchParams.get("status") === "1") {
    return reportResponse(await readInstagramDailyMenuSnapshot());
  }
  const posts = request.nextUrl.searchParams.getAll("post").slice(0, 3);
  const report = await refreshInstagramDailyMenus(posts);
  return reportResponse(report);
}

export async function POST(request: NextRequest) {
  if (!isBratislavaInstagramWatchWindow()) {
    return NextResponse.json(
      { status: "outside_watch_window" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const timestamp = request.headers.get("x-menza-timestamp") ?? "";
  const signature = request.headers.get("x-menza-signature") ?? "";
  const timestampMs = Number(timestamp);
  if (!Number.isSafeInteger(timestampMs) || Math.abs(Date.now() - timestampMs) > SIGNATURE_MAX_AGE_MS) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SIGNED_BODY_BYTES) {
    return NextResponse.json({ status: "payload_too_large" }, { status: 413 });
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_SIGNED_BODY_BYTES) {
    return NextResponse.json({ status: "payload_too_large" }, { status: 413 });
  }

  let signatureBuffer: Buffer;
  try {
    signatureBuffer = Buffer.from(signature, "base64url");
  } catch {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }
  const valid = signatureBuffer.length === 64 && verify(
    null,
    Buffer.from(`${timestamp}.${rawBody}`),
    createPublicKey(MENZA_INGEST_PUBLIC_KEY),
    signatureBuffer,
  );
  if (!valid) return NextResponse.json({ status: "unauthorized" }, { status: 401 });

  let payload: { posts?: InstagramIngestPost[] };
  try {
    payload = JSON.parse(rawBody) as { posts?: InstagramIngestPost[] };
  } catch {
    return NextResponse.json({ status: "invalid_payload" }, { status: 400 });
  }
  if (!Array.isArray(payload.posts) || payload.posts.length === 0 || payload.posts.length > 3) {
    return NextResponse.json({ status: "invalid_payload" }, { status: 400 });
  }
  return reportResponse(await ingestInstagramDailyMenus(payload.posts));
}
