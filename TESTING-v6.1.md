# UNO Score Tracker v6.1.0 testing

## Automated checks

- JavaScript syntax checked for `app.js`, `live-sync.js`, and `v5-features.js`.
- `manifest.webmanifest` and `firebase-database-rules.json` parsed as valid JSON.
- Service-worker asset paths checked against the packaged project.
- Version references checked for the v6.1.0 release.

## Browser checks

- Loaded the app from a local HTTP server.
- Confirmed the page title and footer report v6.1.0.
- Confirmed the Live Game panel is expanded by default for a fresh state.
- Collapsed the Live Game panel and confirmed its controls are hidden.
- Reloaded the page and confirmed the collapsed state is remembered.

## Recommended deployment checks

- Re-test hosting, joining, viewer mode, and station-player controls against the deployed Firebase project.
- Confirm the updated service worker replaces the v6.0 cache on an installed PWA.
