# KDS Mobile

Standalone React Native KDS app for login + kitchen display only.

## Stack

- Expo
- JavaScript
- `twrnc` for Tailwind-style classes
- `expo-speech` for spoken new-order alerts

## Before running

1. Edit `src/config.js`
   - Set `API_BASE` to your Django server, for example `http://192.168.1.50:8000/api`
   - Use your machine LAN IP, not `localhost`, when testing on a real phone/tablet
2. Make sure the backend is running with ASGI/Channels and Redis

## Install

```bash
cd kds-mobile
npm install
```

## Run

```bash
npm start
```

Then open in Expo Go or build locally.

## Features

- Login against `/api/auth/login`
- Loads kitchen stations
- Loads current day tickets
- Live WebSocket KDS updates
- Local sound alert plus spoken voice alert for new orders
- Mark tickets done

## Internal testing

Build an installable Android APK:

```bash
eas build -p android --profile preview
```

That profile is configured for internal distribution and APK output.

## Notes

- Put your order sound file here:
  `kds-mobile/assets/sounds/neworder.mp3`
- That path already exists and currently has a starter sound file.
- If you want your own alert, replace that file with your own `neworder.mp3`.
- App branding files are here:
  `kds-mobile/assets/branding/icon.png`
  `kds-mobile/assets/branding/adaptive-icon.png`
  `kds-mobile/assets/branding/splash-icon.png`
  `kds-mobile/assets/branding/icon.svg`
- Alert behavior is controlled in `kds-mobile/src/config.js`
- This is intentionally focused on KDS only
