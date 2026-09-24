export function isAuthenticatedAivsHtml(html: string): boolean {
  return Boolean(html) && !html.includes('name="heslo"') && !html.includes("<title>Prihlásenie</title>");
}

export function safeDashboardReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/dashboard") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  return value;
}
