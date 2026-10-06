/**
 * Capacitor Network Status Wrapper
 * Uses native network monitoring on iOS/Android, falls back to navigator.onLine on web.
 */
import { Network, ConnectionStatus, ConnectionType } from '@capacitor/network';
import { isNativePlatform, isPluginAvailable } from './capacitor-platform';

export interface NetworkInfo {
  connected: boolean;
  connectionType: ConnectionType | 'unknown';
}

/**
 * Get current network status.
 */
export async function getNetworkStatus(): Promise<NetworkInfo> {
  if (isNativePlatform() && isPluginAvailable('Network')) {
    const status: ConnectionStatus = await Network.getStatus();
    return {
      connected: status.connected,
      connectionType: status.connectionType,
    };
  }

  // Web fallback
  return {
    connected: typeof navigator !== 'undefined' ? navigator.onLine : true,
    connectionType: 'unknown',
  };
}

/**
 * Listen for network status changes.
 * Returns a cleanup function to remove the listener.
 */
export function onNetworkChange(
  callback: (info: NetworkInfo) => void
): () => void {
  if (isNativePlatform() && isPluginAvailable('Network')) {
    const handle = Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
      callback({
        connected: status.connected,
        connectionType: status.connectionType,
      });
    });
    return () => {
      handle.then(h => h.remove());
    };
  }

  // Web fallback
  const onOnline = () => callback({ connected: true, connectionType: 'unknown' });
  const onOffline = () => callback({ connected: false, connectionType: 'unknown' });

  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    }
  };
}
