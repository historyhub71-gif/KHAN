/**
 * Deep link / redirect URLs — same values for preview and production EAS builds.
 * Override via EAS env: EXPO_PUBLIC_DEEP_LINK_SCHEME, EXPO_PUBLIC_PASSWORD_RESET_REDIRECT
 */
export const DEEP_LINK_SCHEME =
  process.env.EXPO_PUBLIC_DEEP_LINK_SCHEME?.trim() || 'myapp';

export const PASSWORD_RESET_REDIRECT =
  process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT?.trim() ||
  `${DEEP_LINK_SCHEME}://reset-password`;

export const PASSWORD_RESET_REDIRECT_ALT = `${PASSWORD_RESET_REDIRECT}/`;

/** Supabase Dashboard → Redirect URLs (documented for deploy checks) */
export const SUPABASE_REDIRECT_ALLOWLIST = [
  PASSWORD_RESET_REDIRECT,
  PASSWORD_RESET_REDIRECT_ALT,
  `${DEEP_LINK_SCHEME}://reset-password/`,
] as const;
