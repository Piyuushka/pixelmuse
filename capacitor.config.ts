import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

/**
 * Capacitor Configuration — PathFinder Access
 *
 * DEPLOYMENT MODES:
 * ─────────────────
 * A) PRODUCTION (recommended):
 *    Deploy your Next.js app to Vercel / Railway / any Node.js host.
 *    Set server.url to your deployed URL below.
 *    Run: npm run mobile:build && npx cap open android
 *
 * B) LOCAL DEV (live reload on device):
 *    1. Find your machine's LAN IP (e.g. 192.168.1.100)
 *    2. Run: npm run dev
 *    3. Uncomment the server block below, set your LAN IP
 *    4. Run: npx cap sync && npx cap open android
 *    The device will load directly from your local Next.js dev server.
 */

const config: CapacitorConfig = {
  appId: 'com.pixelmuse.pathfinderaccess',
  appName: 'PathFinder Access',
  // webDir is used only for static exports (not applicable here).
  // Capacitor requires it to exist even in server-URL mode.
  webDir: 'public',

  // ── LOCAL DEV: live reload from Next.js dev server ──────────────────
  // Android device/emulator loads directly from your local Next.js server.
  // Make sure `npm run dev` is running before opening Android Studio.
  server: {
    url: 'http://10.0.2.2:3000',
    cleartext: true,
  },

  // ── PRODUCTION: point to your deployed Next.js URL ───────────────────
  // When ready to deploy, comment out the server block above and use this:
  // server: {
  //   url: 'https://your-app.vercel.app',
  //   cleartext: false,
  // },

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
