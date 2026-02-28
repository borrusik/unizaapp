import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Simple in-memory rate limiter for middleware
// (Edge Runtime compatible — no Node.js APIs)
// ─────────────────────────────────────────────

const ipRequestMap = new Map<string, { count: number; resetTime: number }>();
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_MINUTE = 60; // General: 60 requests per minute per IP
const MAX_LOGIN_PER_MINUTE = 5; // Login: 5 attempts per minute per IP

const loginAttempts = new Map<string, { count: number; resetTime: number }>();

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
    return false; // Not limited
  }

  entry.count++;
  return entry.count > max; // true = limited
}

// Cleanup every once in a while
let lastCleanup = 0;
function cleanupMaps() {
  const now = Date.now();
  if (now - lastCleanup < 60000) return; // Cleanup every 60s max
  lastCleanup = now;

  for (const [key, val] of ipRequestMap.entries()) {
    if (now > val.resetTime) ipRequestMap.delete(key);
  }
  for (const [key, val] of loginAttempts.entries()) {
    if (now > val.resetTime) loginAttempts.delete(key);
  }

  // Hard cap
  if (ipRequestMap.size > 50000) ipRequestMap.clear();
  if (loginAttempts.size > 50000) loginAttempts.clear();
}

export function middleware(request: NextRequest) {
  cleanupMaps();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const { pathname } = request.nextUrl;

  // ── Block common attack paths ──
  const blockedPaths = [
    "/wp-admin", "/wp-login", "/.env", "/phpinfo",
    "/phpmyadmin", "/admin", "/xmlrpc.php", "/wp-content",
    "/.git", "/config", "/backup", "/shell",
  ];

  if (blockedPaths.some((p) => pathname.toLowerCase().startsWith(p))) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // ── Block suspicious query strings ──
  const url = request.url.toLowerCase();
  const suspiciousPatterns = [
    "union+select", "or+1=1", "<script>", "javascript:", "eval(",
    "../", "..\\", "%00", "cmd=", "exec(",
  ];
  if (suspiciousPatterns.some((p) => url.includes(p))) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // ── General rate limiting ──
  const isLimited = checkRate(ipRequestMap, ip, MAX_REQUESTS_PER_MINUTE, WINDOW_MS);
  if (isLimited) {
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
      return new NextResponse(
        JSON.stringify({ error: "Too many login attempts. Please wait 1 minute." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        }
      );
    }
  }

  // ── Generate CSP nonce ──
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // ── Build CSP header with nonce (no unsafe-inline) ──
  const cspHeader = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    `img-src 'self' blob: data: https: https://www.google-analytics.com https://www.googletagmanager.com`,
    `font-src 'self'`,
    `connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://*.google-analytics.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  // ── Add security headers to response ──
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("X-Download-Options", "noopen");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icons, manifest
     */
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-).*)",
  ],
};
