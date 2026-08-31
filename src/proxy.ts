import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// In-memory rate limiter (Edge Runtime compatible)
// ─────────────────────────────────────────────

const ipRequestMap = new Map<string, { count: number; resetTime: number }>();
const WINDOW_MS = 60 * 1000; // 1 minute window
// A single App Router navigation may produce several RSC and Server Action
// requests. Keep the general ceiling high enough for normal multi-page use;
// login and scanner traffic have stricter limits below.
const MAX_REQUESTS_PER_MINUTE = 240;
const MAX_LOGIN_PER_MINUTE = 5;
const BLOCK_WINDOW_MS = 10 * 60 * 1000; // 10 minute block for repeated offenders

const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const blockedIPs = new Map<string, number>(); // IP -> unblock time

function checkRate(
  map: Map<string, { count: number; resetTime: number }>,
  key: string,
  max: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = map.get(key);

  if (!entry || now > entry.resetTime) {
    map.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }

  entry.count++;
  return entry.count > max;
}

let lastCleanup = 0;
function cleanupMaps() {
  const now = Date.now();
  if (now - lastCleanup < 60000) return;
  lastCleanup = now;

  for (const [key, val] of ipRequestMap.entries()) {
    if (now > val.resetTime) ipRequestMap.delete(key);
  }
  for (const [key, val] of loginAttempts.entries()) {
    if (now > val.resetTime) loginAttempts.delete(key);
  }
  for (const [key, unblockTime] of blockedIPs.entries()) {
    if (now > unblockTime) blockedIPs.delete(key);
  }

  // Hard caps to prevent memory exhaustion
  if (ipRequestMap.size > 50000) ipRequestMap.clear();
  if (loginAttempts.size > 50000) loginAttempts.clear();
  if (blockedIPs.size > 10000) blockedIPs.clear();
}

// ─────────────────────────────────────────────
// Blocked paths & attack patterns
// ─────────────────────────────────────────────

const BLOCKED_PATHS = new Set([
  "/wp-admin", "/wp-login", "/wp-login.php", "/wp-content", "/wp-includes",
  "/xmlrpc.php", "/wp-cron.php", "/wp-json",
  "/.env", "/.env.local", "/.env.production", "/.env.backup",
  "/.git", "/.git/config", "/.gitignore", "/.svn",
  "/phpinfo", "/phpinfo.php", "/phpmyadmin", "/pma",
  "/admin", "/admin.php", "/administrator",
  "/config", "/config.php", "/config.yml", "/config.json",
  "/backup", "/backup.zip", "/backup.sql", "/db.sql", "/dump.sql",
  "/shell", "/shell.php", "/cmd", "/cmd.php",
  "/cgi-bin", "/server-status", "/server-info",
  "/.htaccess", "/.htpasswd", "/web.config",
  "/api/config", "/api/debug", "/api/test",
  "/eval", "/exec", "/system",
  "/.aws", "/.docker", "/docker-compose.yml",
  "/package.json", "/package-lock.json", "/node_modules",
  "/composer.json", "/composer.lock", "/vendor",
]);

const SUSPICIOUS_PATTERNS = [
  "union+select", "union%20select", "select+from", "select%20from",
  "or+1=1", "or%201=1", "and+1=1", "'+or+'",
  "<script>", "<script", "%3cscript", "javascript:",
  "eval(", "exec(", "system(", "passthru(",
  "../", "..\\", "..%2f", "..%5c",
  "%00", "%0d%0a",
  "cmd=", "/etc/passwd", "/etc/shadow", "/proc/self",
  "base64,", "onmouseover=", "onerror=", "onload=",
  "document.cookie", "window.location",
];

const BLOCKED_USER_AGENTS = [
  "sqlmap", "nikto", "nmap", "dirbuster", "gobuster",
  "masscan", "wpscan", "hydra", "burpsuite",
  "havij", "acunetix", "nessus", "openvas",
];

export function proxy(request: NextRequest) {
  cleanupMaps();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const { pathname } = request.nextUrl;

  // ── Check if IP is blocked ──
  const blockExpiry = blockedIPs.get(ip);
  if (blockExpiry && Date.now() < blockExpiry && process.env.NODE_ENV !== "development") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ── Block known attack tools by User-Agent ──
  const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
  if (BLOCKED_USER_AGENTS.some((bot) => userAgent.includes(bot))) {
    blockedIPs.set(ip, Date.now() + BLOCK_WINDOW_MS);
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ── Block common attack paths ──
  const lowerPath = pathname.toLowerCase();
  if (BLOCKED_PATHS.has(lowerPath) || lowerPath.endsWith(".php") || lowerPath.endsWith(".asp") || lowerPath.endsWith(".aspx") || lowerPath.endsWith(".jsp")) {
    // Auto-block IPs that scan for vulnerabilities repeatedly
    const scanKey = `scan_${ip}`;
    const isScanLimited = checkRate(ipRequestMap, scanKey, 3, WINDOW_MS);
    if (isScanLimited) {
      blockedIPs.set(ip, Date.now() + BLOCK_WINDOW_MS);
    }
    return new NextResponse("Not Found", { status: 404 });
  }

  // ── Block suspicious query strings / URL patterns ──
  let fullUrl = request.url.toLowerCase();
  try {
    fullUrl = decodeURIComponent(fullUrl);
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }
  if (SUSPICIOUS_PATTERNS.some((p) => fullUrl.includes(p))) {
    blockedIPs.set(ip, Date.now() + BLOCK_WINDOW_MS);
    return new NextResponse("Bad Request", { status: 400 });
  }

  // ── Block requests with oversized headers (header injection) ──
  const cookieHeader = request.headers.get("cookie") || "";
  if (cookieHeader.length > 4096) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // ── General rate limiting ──
  const isLimited = checkRate(ipRequestMap, ip, MAX_REQUESTS_PER_MINUTE, WINDOW_MS);
  if (isLimited && process.env.NODE_ENV !== "development") {
    return new NextResponse(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      }
    );
  }

  // ── Login-specific rate limiting (stricter) ──
  if (pathname === "/" && request.method === "POST") {
    const loginLimited = checkRate(loginAttempts, ip, MAX_LOGIN_PER_MINUTE, WINDOW_MS);
    if (loginLimited) {
      // Block IP for 10 minutes after too many login attempts
      blockedIPs.set(ip, Date.now() + BLOCK_WINDOW_MS);
      return new NextResponse(
        JSON.stringify({ error: "Too many login attempts. Blocked for 10 minutes." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "600",
          },
        }
      );
    }
  }

  // ── Generate CSP nonce ──
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // ── Build strict CSP header with nonce ──
  const cspHeader = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https://www.google-analytics.com https://www.googletagmanager.com`,
    `font-src 'self'`,
    `connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://*.google-analytics.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  // ── Forward nonce to app via request headers ──
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // ── Security headers ──
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("X-Download-Options", "noopen");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");

  // Remove server information headers
  response.headers.delete("X-Powered-By");
  response.headers.delete("Server");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-).*)",
  ],
};
