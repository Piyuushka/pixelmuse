# PathFinder Access — Setup Guide for Collaborators

## Prerequisites (install these first)

| Tool | Download Link | Notes |
|------|-------------|-------|
| **Node.js 20+** | https://nodejs.org | Choose LTS version |
| **Android Studio** | https://developer.android.com/studio | Includes JDK 17 + Android SDK |

---

## Step 1 — Extract the ZIP

Extract `PathFinderAccess-Mobile.zip` anywhere on your PC, e.g.:
```
C:\Projects\PathFinderAccess\
```

---

## Step 2 — Install dependencies

Open a terminal in the extracted folder and run:
```bash
npm install
```
This restores `node_modules` (~400 MB, takes 2-3 minutes).

---

## Step 3 — Find YOUR machine's LAN IP

Run this in PowerShell:
```powershell
ipconfig | Select-String "IPv4"
```
Look for a line like `192.168.1.XXX` (your home/office Wi-Fi IP).

---

## Step 4 — Update the server URL

Open `capacitor.config.ts` and change the IP to **YOUR** IP:

```typescript
server: {
  url: 'http://192.168.1.XXX:3000',  // ← replace with YOUR IP
  cleartext: true,
},
```

---

## Step 5 — Sync Capacitor

```bash
npx cap sync android
```

---

## Step 6 — Run the app

**Open two terminals side by side:**

**Terminal 1** — Start the web server (keep this running):
```bash
npm run dev
```
Wait until you see `✓ Ready on http://localhost:3000`

**Terminal 2** — Open Android Studio:
```bash
npx cap open android
```

---

## Step 7 — Run in Android Studio

1. Wait for **Gradle sync** to finish (first time: ~3-5 min, bottom status bar)
2. **Emulator:** Device Manager → Create Device → Pixel 7 → API 34 → ▶ Run
3. **Physical Phone:** Enable USB Debugging → plug in via USB → ▶ Run

> ⚠️ If using a **physical Android phone**, it must be on the **same Wi-Fi network** as your PC.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| White/blank screen on device | Check your IP in `capacitor.config.ts` is correct |
| `npm install` fails | Make sure Node.js 20+ is installed |
| Gradle sync fails | Android Studio → File → Invalidate Caches → Restart |
| `npx cap open android` does nothing | Open Android Studio manually → Open folder → select the `android/` folder |
| Port 3000 blocked | Try `npm run dev -- -p 3001` and update the port in `capacitor.config.ts` |

---

## Quick Reference

| Command | What it does |
|---------|-------------|
| `npm install` | Install all packages |
| `npm run dev` | Start local web server (keep open!) |
| `npx cap sync android` | Sync config changes to Android project |
| `npx cap open android` | Open Android Studio |
