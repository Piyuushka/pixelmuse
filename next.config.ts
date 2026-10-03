import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: We do NOT use output: 'export' because this app has API routes
  // (auth, Gemini AI assistant, routing, SSE) that require a Node.js server.
  //
  // Capacitor is configured to load from a deployed server URL instead.
  // See capacitor.config.ts `server.url` for the remote URL configuration.
  //
  // For local development with live reload on a device:
  //   1. Run: npm run dev
  //   2. In capacitor.config.ts, uncomment `server.url` and set your LAN IP
  //   3. Run: npx cap sync && npx cap open android
};

export default nextConfig;
