const BRATISLAVA_CLOCK = new Intl.DateTimeFormat("en", {
  timeZone: "Europe/Bratislava",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getBratislavaClock(date: Date) {
  const values = Object.fromEntries(
    BRATISLAVA_CLOCK
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function parseTimeInSeconds(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 3600 + minute * 60;
}

export function getBratislavaDayIndex(date = new Date()): number {
  const clock = getBratislavaClock(date);
  return new Date(Date.UTC(clock.year, clock.month - 1, clock.day)).getUTCDay();
}

export function getScheduleTiming(
  timeStart: string,
  timeEnd: string,
  now: Date,
  isSelectedDayToday: boolean,
) {
  const startSeconds = parseTimeInSeconds(timeStart);
  const endSeconds = parseTimeInSeconds(timeEnd);

  if (
    !isSelectedDayToday ||
    startSeconds === null ||
    endSeconds === null ||
    endSeconds <= startSeconds
  ) {
    return { isLive: false, progress: 0, minsLeft: 0 };
  }

  const clock = getBratislavaClock(now);
  const nowSeconds = clock.hour * 3600 + clock.minute * 60 + clock.second;
  const isLive = nowSeconds >= startSeconds && nowSeconds <= endSeconds;

  if (!isLive) return { isLive: false, progress: 0, minsLeft: 0 };

  const duration = endSeconds - startSeconds;
  const elapsed = nowSeconds - startSeconds;

  return {
    isLive: true,
    progress: Math.min(Math.max((elapsed / duration) * 100, 0), 100),
    minsLeft: Math.max(Math.ceil((endSeconds - nowSeconds) / 60), 0),
  };
}
