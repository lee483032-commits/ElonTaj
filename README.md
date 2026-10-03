# Elon Taj Android wrapper

This is a Capacitor Android shell for the existing Elon Taj frontend. The backend is intentionally not bundled into the APK: Node.js + SQLite must run on a persistent HTTPS host.

See `ANDROID_BUILD_TG.md` for Tajik setup and release signing steps.

Set `window.ELON_TAJ_API_BASE` in `public/app-config.js` to your deployed backend origin before building/syncing Android.
