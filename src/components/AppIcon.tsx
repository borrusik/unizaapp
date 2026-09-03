import type { ReactNode, SVGProps } from "react";

export type AppIconName =
  | "arrow-left"
  | "award"
  | "book"
  | "bell"
  | "building"
  | "calendar"
  | "check"
  | "chevron-down"
  | "chevron-right"
  | "clipboard"
  | "download"
  | "empty-calendar"
  | "external-link"
  | "history"
  | "home"
  | "info"
  | "instagram"
  | "lock"
  | "mail"
  | "map-pin"
  | "pin"
  | "refresh"
  | "restaurant"
  | "search"
  | "shield"
  | "library"
  | "user"
  | "warning"
  | "x";

type AppIconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: AppIconName;
  size?: number;
};

const paths: Record<AppIconName, ReactNode> = {
  "arrow-left": <path d="m15 18-6-6 6-6" />,
  award: <><circle cx="12" cy="8" r="5" /><path d="m8.5 12-1 9 4.5-2.5 4.5 2.5-1-9" /><path d="m10 8 1.3 1.3L14.5 6" /></>,
  book: <><path d="M3.5 5.5A3.5 3.5 0 0 1 7 3h2.5A2.5 2.5 0 0 1 12 5.5V21a3.8 3.8 0 0 0-3.5-2H3.5Z" /><path d="M20.5 5.5A3.5 3.5 0 0 0 17 3h-2.5A2.5 2.5 0 0 0 12 5.5V21a3.8 3.8 0 0 1 3.5-2h5Z" /><path d="M6.5 7h2M15.5 7h2" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  building: <><path d="M4 21h16M6 21V5l6-3 6 3v16" /><path d="M9 8h1m4 0h1M9 12h1m4 0h1M9 16h6v5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4m8-4v4M3 10h18" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  "chevron-down": <path d="m7 10 5 5 5-5" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M9 9h6m-6 4h6m-6 4h4" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 21h14" /></>,
  "empty-calendar": <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4m8-4v4M3 10h18m-6 4v3m-1.5-1.5h3" /></>,
  "external-link": <><path d="M14 5h5v5m0-5-8 8" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5m4-1v5l3 2" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10M9 21v-6h6v6" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  "map-pin": <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  pin: <><path d="m9 3 6 6m-7.5 1.5 6 6M6 21l3.5-3.5M8 6l10 10M7 7l3-3 10 10-3 3" /></>,
  refresh: <><path d="M20 7V3l-1.9 1.9A8 8 0 1 0 20 14" /><path d="M20 3h-4" /></>,
  restaurant: <><path d="M4 3v7a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2V3M7.5 3v18" /><path d="M20 14V3a5 5 0 0 0-5 5v4a2 2 0 0 0 2 2h3Zm0 0v7" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  library: <><path d="M3 21h18M5 18V8m4 10V8m6 10V8m4 10V8M2 8h20L12 3Z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
  warning: <><path d="M10.3 3.6 2.6 18a2 2 0 0 0 1.8 3h15.2a2 2 0 0 0 1.8-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
  x: <path d="m6 6 12 12M18 6 6 18" />,
};

export function AppIcon({ name, size = 24, className, ...props }: AppIconProps) {
  return (
    <svg
      aria-hidden={props["aria-label"] ? undefined : true}
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
