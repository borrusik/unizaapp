import * as cheerio from "cheerio";

export type AivsScheduleSourceState = "available" | "unavailable" | "unauthenticated";

export function isAivsScheduleContinuation(className: string): boolean {
  return className.split(/\s+/).some((name) => /^rozvrh_bloky-.+-c$/.test(name));
}

export function getAivsScheduleSourceState(html: string): AivsScheduleSourceState {
  if (!html || html.includes('name="heslo"')) return "unauthenticated";

  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ").toLocaleLowerCase("sk");
  if (text.includes("rozvrh je neprístupný") || text.includes("rozvrh je nepristupny")) {
    return "unavailable";
  }
  return "available";
}
