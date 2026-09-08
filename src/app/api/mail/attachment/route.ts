import { NextRequest, NextResponse } from "next/server";
import { getMailAttachment } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "attachment";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: NextRequest) {
  try {
    const folder = request.nextUrl.searchParams.get("folder") ?? "INBOX";
    const uid = Number(request.nextUrl.searchParams.get("uid"));
    const index = Number(request.nextUrl.searchParams.get("index"));
    const attachment = await getMailAttachment(folder, uid, index);
    return new NextResponse(Buffer.from(attachment.content, "base64"), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Type": attachment.contentType,
        "Content-Disposition": contentDisposition(attachment.filename),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Attachment is unavailable" }, { status: 404 });
  }
}
