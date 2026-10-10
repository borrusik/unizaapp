// Temporarily paused while the built-in mail client is being optimized.
// Keep the implementation reversible; students use the official webmail instead.
export const INTERNAL_MAIL_ENABLED = false;

export function assertInternalMailEnabled() {
  if (!INTERNAL_MAIL_ENABLED) throw new Error("MAIL_DISABLED");
}
