/**
 * Capacitor Platform Detection
 * Provides helpers to determine runtime environment (native app vs. web browser).
 */
import { Capacitor } from '@capacitor/core';

/** True when running inside a native iOS/Android shell */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/** Returns 'ios' | 'android' | 'web' */
export const getPlatform = (): 'ios' | 'android' | 'web' => {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
};

/** True when a specific Capacitor plugin is available at runtime */
export const isPluginAvailable = (pluginName: string): boolean => {
  return Capacitor.isPluginAvailable(pluginName);
};
