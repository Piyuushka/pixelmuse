/**
 * Capacitor Push Notification Handler
 * Handles push notification registration, token management,
 * and notification event listeners for barrier alerts.
 */
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { isNativePlatform, isPluginAvailable } from './capacitor-platform';

export interface PushHandlers {
  onRegistration?: (token: string) => void;
  onRegistrationError?: (error: string) => void;
  onNotificationReceived?: (notification: PushNotificationSchema) => void;
  onNotificationAction?: (action: ActionPerformed) => void;
}

/**
 * Initialize push notifications on native platforms.
 * No-op on web (web push would require a separate Service Worker setup).
 */
export async function initPushNotifications(handlers: PushHandlers = {}): Promise<boolean> {
  if (!isNativePlatform() || !isPluginAvailable('PushNotifications')) {
    console.log('[Push] Not available on this platform — skipping initialization.');
    return false;
  }

  // Request permission
  const permResult = await PushNotifications.requestPermissions();
  if (permResult.receive !== 'granted') {
    console.warn('[Push] Permission denied by user.');
    return false;
  }

  // Register with APNS (iOS) / FCM (Android)
  await PushNotifications.register();

  // Listen for registration success
  PushNotifications.addListener('registration', (token: Token) => {
    console.log('[Push] Registered with token:', token.value);
    handlers.onRegistration?.(token.value);
  });

  // Listen for registration errors
  PushNotifications.addListener('registrationError', (error) => {
    console.error('[Push] Registration error:', error);
    handlers.onRegistrationError?.(JSON.stringify(error));
  });

  // Listen for notifications received while app is in foreground
  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('[Push] Notification received:', notification);
    handlers.onNotificationReceived?.(notification);
  });

  // Listen for notification tap actions
  PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    console.log('[Push] Notification action:', action);
    handlers.onNotificationAction?.(action);
  });

  return true;
}

/**
 * Remove all push notification listeners (cleanup).
 */
export async function removePushListeners(): Promise<void> {
  if (isNativePlatform() && isPluginAvailable('PushNotifications')) {
    await PushNotifications.removeAllListeners();
  }
}
