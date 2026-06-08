import * as Linking from 'expo-linking';

let subscribed = false;

export function logLinkingDiagnostics(label: string, url: string | null): void {
  if (!url) {
    console.log(`[Linking:${label}] No URL`);
    return;
  }
  try {
    const parsed = Linking.parse(url);
    console.log(`[Linking:${label}]`, {
      url: url.substring(0, 120) + (url.length > 120 ? '…' : ''),
      scheme: parsed.scheme,
      hostname: parsed.hostname,
      path: parsed.path,
      queryKeys: parsed.queryParams ? Object.keys(parsed.queryParams) : [],
    });
  } catch (error) {
    console.log(`[Linking:${label}] Raw URL (parse failed):`, url, error);
  }
}

/** Subscribe once at app root — logs cold start + warm deep links (production debugging). */
export function subscribeToLinkingLogs(): () => void {
  if (subscribed) {
    return () => {};
  }
  subscribed = true;

  Linking.getInitialURL().then((url) => logLinkingDiagnostics('initial', url));

  const sub = Linking.addEventListener('url', (event) => {
    logLinkingDiagnostics('event', event.url);
  });

  return () => {
    sub.remove();
    subscribed = false;
  };
}
