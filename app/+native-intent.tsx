import { setPendingRecoveryUrl, isRecoveryUrl } from '../utils/recoveryLink';

/**
 * Maps Android/iOS system deep link paths into Expo Router routes.
 * Full URL (with tokens) is captured separately via Linking.getInitialURL in _layout.
 * @see https://docs.expo.dev/router/reference/linking/#native-intent
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    if (initial) {
      console.log('[native-intent] initial path:', path);
    }

    const lower = path.toLowerCase();
    if (
      lower.includes('reset-password') ||
      lower.includes('type=recovery') ||
      lower.includes('access_token') ||
      lower.includes('code=')
    ) {
      if (initial && isRecoveryUrl(path)) {
        setPendingRecoveryUrl(path);
      }
      return '/reset-password';
    }
  } catch (error) {
    console.warn('[native-intent] redirectSystemPath error:', error);
  }
  return path;
}
