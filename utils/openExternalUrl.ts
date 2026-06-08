import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Platform } from 'react-native';

export type OpenUrlResult = 'opened' | 'browser' | 'unsupported' | 'failed';

/**
 * Open http(s) or custom-scheme URLs on Android production (API 30+ package visibility).
 */
export async function openExternalUrl(
  url: string,
  options?: { dialogTitle?: string }
): Promise<OpenUrlResult> {
  const trimmed = url?.trim();
  if (!trimmed) {
    console.warn('[openExternalUrl] Empty URL');
    return 'failed';
  }

  try {
    const canOpen = await Linking.canOpenURL(trimmed);
    if (canOpen) {
      await Linking.openURL(trimmed);
      console.log('[openExternalUrl] Opened via Linking:', trimmed);
      return 'opened';
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      await WebBrowser.openBrowserAsync(trimmed, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
        ...(options?.dialogTitle ? { toolbarColor: undefined } : {}),
      });
      console.log('[openExternalUrl] Opened via WebBrowser:', trimmed);
      return 'browser';
    }

    console.warn('[openExternalUrl] Cannot open URL on device:', trimmed);
    if (Platform.OS === 'android') {
      Alert.alert(
        'Cannot open link',
        'No app on this device can handle this link. Try opening it in your browser.'
      );
    }
    return 'unsupported';
  } catch (error) {
    console.error('[openExternalUrl] Failed:', trimmed, error);
    if (trimmed.startsWith('http')) {
      try {
        await WebBrowser.openBrowserAsync(trimmed);
        return 'browser';
      } catch (browserErr) {
        console.error('[openExternalUrl] WebBrowser fallback failed:', browserErr);
      }
    }
    return 'failed';
  }
}
