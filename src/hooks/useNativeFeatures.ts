/**
 * useNativeFeatures — Unified Capacitor feature hook
 * Initialises push notifications, subscribes to network changes,
 * and exposes platform info to any component.
 *
 * Mount this hook once near the root of your app (e.g. in layout.tsx or
 * a dedicated CapacitorInit component).
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { isNativePlatform, getPlatform, isPluginAvailable } from '@/utils/capacitor-platform';
import { initPushNotifications, removePushListeners } from '@/utils/capacitor-push';
import { getNetworkStatus, onNetworkChange, NetworkInfo } from '@/utils/capacitor-network';

export interface NativeFeaturesState {
  platform: 'ios' | 'android' | 'web';
  isNative: boolean;
  isOnline: boolean;
  connectionType: string;
  pushToken: string | null;
  keyboardHeight: number;
}

export function useNativeFeatures() {
  const [state, setState] = useState<NativeFeaturesState>({
    platform: getPlatform(),
    isNative: isNativePlatform(),
    isOnline: true,
    connectionType: 'unknown',
    pushToken: null,
    keyboardHeight: 0,
  });

  const updateNetwork = useCallback((info: NetworkInfo) => {
    setState(prev => ({
      ...prev,
      isOnline: info.connected,
      connectionType: info.connectionType,
    }));
  }, []);

  useEffect(() => {
    if (!isNativePlatform()) return;

    let cleanupNetwork: (() => void) | undefined;

    async function initNative() {
      // ── Status Bar ──
      if (isPluginAvailable('StatusBar')) {
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#1D4ED8' });
      }

      // ── Splash Screen ──
      if (isPluginAvailable('SplashScreen')) {
        await SplashScreen.hide({ fadeOutDuration: 300 });
      }

      // ── Network ──
      const netStatus = await getNetworkStatus();
      updateNetwork(netStatus);
      cleanupNetwork = onNetworkChange(updateNetwork);

      // ── Keyboard ──
      if (isPluginAvailable('Keyboard')) {
        Keyboard.addListener('keyboardWillShow', (info) => {
          setState(prev => ({ ...prev, keyboardHeight: info.keyboardHeight }));
        });
        Keyboard.addListener('keyboardWillHide', () => {
          setState(prev => ({ ...prev, keyboardHeight: 0 }));
        });
      }

      // ── Push Notifications ──
      await initPushNotifications({
        onRegistration: (token) => {
          setState(prev => ({ ...prev, pushToken: token }));
          // TODO: Send token to your server API for targeted barrier alerts
          // fetch('/api/user/push-token', { method: 'POST', body: JSON.stringify({ token }) });
        },
        onNotificationReceived: (notification) => {
          console.log('[Native] Push received:', notification.title);
        },
      });

      // ── App State (resume / pause) ──
      App.addListener('appStateChange', ({ isActive }) => {
        console.log('[Native] App state changed, isActive:', isActive);
      });

      // ── Back Button (Android) ──
      App.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
          App.exitApp();
        } else {
          window.history.back();
        }
      });
    }

    initNative().catch(console.error);

    return () => {
      cleanupNetwork?.();
      removePushListeners().catch(console.error);
      if (isPluginAvailable('Keyboard')) {
        Keyboard.removeAllListeners();
      }
      App.removeAllListeners();
    };
  }, [updateNetwork]);

  return state;
}
