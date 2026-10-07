import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

/**
 * Capacitor Configuration — PathFinder Access
 *
 * SERVER URL / LOADING MODES:
 * ────────────────────────────
 * 1. LOCAL ANDROID EMULATOR (default):
 *    server.url: 'http://10.0.2.2:3000'
 *    (10.0.2.2 is the special alias to your host PC localhost inside the Android emulator)
 *
 * 2. PHYSICAL DEVICE OVER WI-FI:
 *    Find your computer's local Wi-Fi IP (run `ipconfig` in terminal, e.g. 192.168.1.50)
 *    server.url: 'http://<YOUR_LOCAL_IP>:3000' (e.g. 'http://192.168.1.50:3000')
 *    Make sure your phone and PC are connected to the same Wi-Fi network.
 *
 * 3. PRODUCTION DEPLOYMENT (Vercel / Cloud):
 *    server.url: 'https://your-production-domain.vercel.app'
 *    cleartext: false
 */

const config: CapacitorConfig = {
  appId: 'com.pathfinder.access',
  appName: 'PathFinder Access',
  webDir: 'public',

  server: {
    // Android emulator special localhost alias
    url: 'http://10.0.2.2:3000',
    cleartext: true,
    androidScheme: 'https',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1D4ED8',
      showSpinner: true,
      spinnerColor: '#FFFFFF',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#1D4ED8',
    },
    Keyboard: {
      resize: KeyboardResize.Body,
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
