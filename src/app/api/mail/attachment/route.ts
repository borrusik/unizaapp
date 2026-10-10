import { NextRequest, NextResponse } from "next/server";
import { getMailAttachment } from "@/lib/mail";
import { INTERNAL_MAIL_ENABLED } from "@/lib/features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INLINE_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
]);

function contentDisposition(filename: string, inline: boolean): string {
  const fallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "attachment";
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: NextRequest) {
  if (!INTERNAL_MAIL_ENABLED) return NextResponse.json({ error: "MAIL_DISABLED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const folder = request.nextUrl.searchParams.get("folder") ?? "INBOX";
    const uid = Number(request.nextUrl.searchParams.get("uid"));
    const index = Number(request.nextUrl.searchParams.get("index"));
    const attachment = await getMailAttachment(folder, uid, index);
    const normalizedContentType = attachment.contentType.split(";", 1)[0].trim().toLowerCase();
    const inline = request.nextUrl.searchParams.get("disposition") === "inline"
      && INLINE_CONTENT_TYPES.has(normalizedContentType);
    return new NextResponse(Buffer.from(attachment.content, "base64"), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Type": attachment.contentType,
        "Content-Disposition": contentDisposition(attachment.filename, inline),
        "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Frame-Options": inline ? "SAMEORIGIN" : "DENY",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "MAIL_RECONNECT_REQUIRED" ? 401
      : message === "MAIL_ATTACHMENT_TOO_LARGE" ? 413
      : message === "Invalid attachment" || message === "Invalid message" || message === "Invalid mailbox" ? 400
      : message === "Attachment is unavailable" ? 404 : 502;
    return NextResponse.json({ error: status === 413 ? "Attachment exceeds the 12 MB download limit"
      : status === 401 ? "Sign in again to open mail" : "Attachment is unavailable" }, { status });
  }
}
