import { NextResponse } from "next/server";
import { getInstagramDailyMenus } from "@/lib/instagram";
import { isBratislavaInstagramWatchWindow } from "@/lib/instagram-scrape";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!isBratislavaInstagramWatchWindow()) {
    return NextResponse.json(
      { status: "outside_watch_window" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const menus = await getInstagramDailyMenus(false);
  return NextResponse.json(
    { status: "checked", menuCount: menus.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
