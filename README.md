# UNO Direction & Score Tracker v5.0.0

A lightweight, installable Progressive Web App for tracking play direction, calculating cards left in losing hands, and keeping UNO scores.

## Features

- Works offline after the first visit
- Installable on Android, iPhone, iPad and desktop
- Direction tracker with vibration feedback on supported devices
- Card-point calculator with UNO-style card sprites
- Presets for Classic, Teams, Flip, All Wild, Flex and Show 'Em No Mercy
- Editable player/team names, scores, target score and card values
- Automatic local saving
- Editable round history with complete score deltas, totals, timing and undo
- Saved-game library with resume, rename, duplicate and delete
- Reusable local player profiles and history-derived statistics
- System, light, dark, high-contrast and reduced-motion themes
- Responsive fullscreen scoreboard and polished winner/rematch flow
- Firebase live multiplayer with anonymous auth, presence, QR joining and reconnect
- In-app update notification when a new service worker is available

## Run locally

A service worker requires the app to be served over HTTP rather than opened directly as a file.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Publish with GitHub Pages

1. Create a new GitHub repository.
2. Upload every file and folder from this project, including `.github`.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select **GitHub Actions**.
5. Push to the `main` branch. The included workflow publishes the app automatically.

Your public address will normally be:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

## Install on a phone

### Android
Open the published address in Chrome, then choose **Install app** or use the app's Install button.

### iPhone/iPad
Open the published address in Safari, tap **Share**, then **Add to Home Screen**.

## Development notes

This project intentionally uses plain HTML, CSS and JavaScript. There is no build step or dependency installation. Change the cache name in `service-worker.js` whenever publishing a release that must invalidate older cached files.

## Trademark note

This is an unofficial companion tool and is not affiliated with or endorsed by Mattel. UNO is a trademark of its respective owner. The card graphics are original CSS-style representations rather than official artwork.

## Version 3.0 additions

- Saved player profiles
- Random starting-player picker
- Lifetime statistics
- Global undo for major game actions
- Optional sound, haptics and winner confetti
- Shareable game snapshots using the Web Share API or clipboard
- Improved dark mode and mobile interactions

### Local data and privacy

Games, profiles and preferences are stored only in this browser unless a host starts a Firebase live room. Profiles use initials or emoji and a preferred colour; uploaded profile photographs and accounts are not used. Browser storage can be cleared by the browser or operating system, so the saved-game library is convenient local persistence rather than a backup service.


## Live cross-device viewer mode (v4)

Live mode uses Firebase Authentication (anonymous accounts) and Firebase Realtime Database. The host has write access; viewers are read-only. A QR join link and a six-character room code are both provided.

### One-time Firebase setup

1. Create a Firebase project at the Firebase Console.
2. Add a **Web app** to the project and copy its configuration into `firebase-config.js`.
3. Open **Authentication → Sign-in method** and enable **Anonymous** authentication.
4. Under **Authentication → Settings → Authorized domains**, add the production Pages/custom domain and local test hosts such as `localhost` and `127.0.0.1`. If the Google Cloud API key has HTTP-referrer restrictions, allow the same origins.
5. Create a **Realtime Database**. Do not leave it in public test mode.
6. Open the database **Rules** tab, paste the contents of `firebase-database-rules.json`, and publish the rules.
7. Commit `firebase-config.js` to GitHub and wait for GitHub Pages to redeploy. Firebase Web configuration identifiers are public by design; the security boundary is Authentication plus the published database rules.

### Security model

- Only the anonymous Firebase user that created a room can write or delete it.
- Any authenticated viewer who knows the random room link or six-character code can read that room. Game data contains only names, scores, direction, and round history, so do not enter sensitive personal information.
- Room codes are convenient access locators, not passwords. End the room when play finishes.
- The app has no public room listing, chat, passwords, or account profiles.

### QR note

QR images are generated locally in the browser using QRCode.js loaded from cdnjs. The room URL is not sent to a QR-image service.


## Version 4.5 additions

- Live connected-device count using Firebase presence
- Automatic host and viewer reconnection after refresh or reopening
- Enlarged full-screen QR join view
- Full-screen read-only scoreboard display for a shared tablet or TV
- Updated security rules allowing each authenticated device to manage only its own presence record


## Version 4.6 additions

- Synced game timer with start, pause, resume and reset controls
- Timer appears prominently in full-screen scoreboard mode
- Optional Screen Wake Lock button on supported devices
- Timer state reconnects and updates for live viewers


## Version 4.7 additions

- Fixed standalone and multiplayer Start, Pause, Resume and Reset timer behaviour
- Synchronized running timers with Firebase server time to prevent drift across connected devices and reconnects
- Moved the Game Timer directly below Live Game and Choose Starter above Direction
- Moved Saved Players below Scores
- Added a Settings & Sharing section for Sound and Share Snapshot
- Made secondary sections collapsible and remembered each section's open or closed state
- Improved spacing, controls and card layout for smaller mobile screens


## Version 5.0 additions

- Complete round records: every player's delta and resulting total, round number, timestamp, card summary and optional duration
- Expandable history directly below Scores, with Undo Last Round and confirmed edit/delete actions that recalculate totals
- Automatic standalone saved games with Resume Last Game, rename, resume, duplicate and delete
- Safe v4.7 migration into the v5 current-game, saved-game and object-profile schemas
- Per-player and per-game statistics derived from saved round histories, including win percentage, round averages, high/low rounds, game duration and winning streaks
- Local player profiles with initials/emoji avatar, preferred colour and lifetime results
- Responsive fullscreen presentation with names, scores, starter, direction, round, timer, device count and optional live-room QR
- Winner standings, rematch, results sharing, optional confetti/sound/vibration and reduced-motion support
- System/light/dark themes, high contrast, larger focus indicators, ARIA improvements and keyboard-accessible controls
- Hardened listener cleanup, offline/reconnect status, duplicate-round prevention, client validation and Firebase Database rules
- Scoped cache cleanup and runtime caching for dependency-light offline use

See `CHANGELOG.md` for the release summary and `CURRENT-STATE-v4.7.md` for the pre-edit architecture audit.

## v4.7 data migration

On first v5 load, the app reads `uno-score-tracker-v5-current` or falls back to the existing `uno-score-tracker-v4` record. It converts string player profiles to profile objects, expands legacy round entries, computes a score baseline so existing totals remain unchanged, assigns a stable local game id, and writes v5 data under new keys. The v4 record is retained as a recovery copy. Corrupt JSON is ignored and replaced with validated defaults without preventing startup.

## Data model summary

The active game is the authoritative model for names, scores, score baseline, direction, starter, rules, history, timer and settings. Round edits and deletions recompute scores from `scoreBaseline + round changes`; statistics are derived from round history rather than maintained as competing counters. Firebase hosts synchronize a bounded v5 DTO while profiles and the saved-game library remain local.

## Known operational assumptions

- A Firebase live room has one editing host and read-only joined viewers. Unexpected host loss leaves viewers in a waiting state until the same anonymous host session reconnects or the room is explicitly ended.
- Room codes locate rooms but are not passwords. Firebase rules and anonymous authentication are the security boundary.
- Browser local storage is finite and device-local. The app caps the saved library at 100 games and Firebase history at 200 rounds.
- Wake Lock, Web Share, vibration and clipboard behavior depend on browser support and permission policy.
- QRCode.js and Firebase are CDN-loaded and runtime-cached after a successful fetch; a completely fresh offline install cannot start live mode.

## Release checks

Before deployment, validate `firebase-database-rules.json` in the Firebase Emulator Suite or Rules Playground, publish the rules, then test one host and at least one viewer in separate browser profiles. The static project has no build step.
