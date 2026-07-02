import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Detect whether we are running inside Expo Go.
 * In Expo Go (SDK 53+), remote/native push notifications are NOT supported.
 * All push calls are silently skipped in that case so the app does not crash.
 * In a development build or production APK/IPA the full flow still works.
 */
const isExpoGo =
  Constants.executionEnvironment === 'storeClient' ||
  // Fallback for older expo-constants shapes
  (Constants as any).appOwnership === 'expo';

// Only register the notification handler when push is supported.
if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerForPushNotificationsAsync(): Promise<boolean> {
  // Push notifications are not available in Expo Go (SDK 53+).
  if (isExpoGo) return false;

  if (!Device.isDevice) {
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('attendance-alerts', {
      name: 'Attendance Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return true;
}

export async function scheduleLocalNotification(
  title: string,
  body: string
): Promise<void> {
  // Skip native push in Expo Go — in-app (Supabase) notifications still work.
  if (isExpoGo) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null,
  });
}

