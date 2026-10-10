export function isAivsLoginHtml(html: string): boolean {
  return /<input\b[^>]*\bname\s*=\s*(?:["']heslo["']|heslo(?=[\s>]))/i.test(html)
    || /<title>\s*Prihlásenie\s*<\/title>/i.test(html);
}

export function isAuthenticatedAivsHtml(html: string): boolean {
  return !isAivsLoginHtml(html) && (
    /\bid\s*=\s*["']mch-name-desk["']/i.test(html)
    || /<a\b[^>]*\bhref\s*=\s*["'][^"']*\blogout\.php(?:[?"'])/i.test(html)
  );
}

export function safeDashboardReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/dashboard") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  return value;
}
