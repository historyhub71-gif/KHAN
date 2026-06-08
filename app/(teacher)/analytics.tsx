import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * Safety Redirection Screen
 * Since Analytics is now moved directly into the bottom navigation tab,
 * any direct deep links or pushes to /(teacher)/analytics will be cleanly
 * redirected to the Dashboard tab, preventing duplicate views and routing conflicts.
 */
export default function TeacherAnalyticsRedirectScreen() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to teacher dashboard which renders bottom tab navigator
    router.replace('/(teacher)/dashboard');
  }, [router]);

  return null;
}
