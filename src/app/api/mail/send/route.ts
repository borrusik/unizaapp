import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await sendMail(await request.formData());
    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send message";
    const safeMessage = message.startsWith("Invalid") || message.includes("attachment") || message.includes("empty") || message.includes("many")
      ? message
      : "Unable to send message";
    return NextResponse.json({ error: safeMessage }, { status: 400 });
  }
}
