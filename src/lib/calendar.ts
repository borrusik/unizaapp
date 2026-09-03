export type CalendarEvent = {
  uid: string;
  title: string;
  date: string;
  timeStart: string;
  timeEnd?: string;
  location?: string;
  description?: string;
};

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function localTimestamp(date: string, time: string) {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

function addMinutes(date: string, time: string, minutesToAdd: number) {
  const parsed = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(parsed.getTime())) return { date, time };
  parsed.setUTCMinutes(parsed.getUTCMinutes() + minutesToAdd);
  return {
    date: parsed.toISOString().slice(0, 10),
    time: parsed.toISOString().slice(11, 16),
  };
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function createIcsCalendar(events: CalendarEvent[]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const rows = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UNIZA Student//Calendar//SK",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-TIMEZONE:Europe/Bratislava",
  ];
  for (const event of events) {
    const uid = `${stableHash(event.uid)}@uniza-student`;
    const end = event.timeEnd
      ? { date: event.date, time: event.timeEnd }
      : addMinutes(event.date, event.timeStart, 60);
    rows.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Bratislava:${localTimestamp(event.date, event.timeStart)}`,
      `DTEND;TZID=Europe/Bratislava:${localTimestamp(end.date, end.time)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
    );
    if (event.location) rows.push(`LOCATION:${escapeIcs(event.location)}`);
    if (event.description) rows.push(`DESCRIPTION:${escapeIcs(event.description)}`);
    rows.push("END:VEVENT");
  }
  rows.push("END:VCALENDAR");
  return `${rows.join("\r\n")}\r\n`;
}

export function downloadIcs(events: CalendarEvent[], filename: string) {
  if (typeof window === "undefined" || events.length === 0) return;
  const blob = new Blob([createIcsCalendar(events)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
