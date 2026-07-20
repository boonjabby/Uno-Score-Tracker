# UNO Direction & Score Tracker v6.0.0

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
- Collaborative live controls with universal Reverse, host-reviewed requests, per-device permissions, activity log and host transfer
- In-app update notification when a new service worker is available

## Run locally

A service worker requires the app to be served over HTTP rather than opened directly as a file.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Open with Chrome or Safari

https://boonjabby.github.io/Uno-Score-Tracker/

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


## Live cross-device multiplayer

Live mode uses Firebase Authentication (anonymous accounts) and Firebase Realtime Database. The host remains authoritative. Players and viewers can submit Reverse immediately and request protected actions; the host can grant narrowly scoped Controller permissions. A QR join link and a six-character room code are both provided.

### One-time Firebase setup

1. Create a Firebase project at the Firebase Console.
2. Add a **Web app** to the project and copy its configuration into `firebase-config.js`.
3. Open **Authentication → Sign-in method** and enable **Anonymous** authentication.
4. Under **Authentication → Settings → Authorized domains**, add the production Pages/custom domain and local test hosts such as `localhost` and `127.0.0.1`. If the Google Cloud API key has HTTP-referrer restrictions, allow the same origins.
5. Create a **Realtime Database**. Do not leave it in public test mode.
6. Open the database **Rules** tab, paste the contents of `firebase-database-rules.json`, and publish the rules.
7. Commit `firebase-config.js` to GitHub and wait for GitHub Pages to redeploy. Firebase Web configuration identifiers are public by design; the security boundary is Authentication plus the published database rules.

### Security model

- Only the current host can write authoritative game state, review requests, grant permissions, transfer hosting, or delete a room.
- Joined members can write only their own member/presence record and create immutable commands or request submissions. They cannot directly overwrite game state or approve their own requests.
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


## Version 5.1 additions

- Fixed Saved Players cards so lifetime points, rounds, games and wins refresh immediately after round awards, edits, deletions and undo
- Added optional UNO-style card sprites and card-point subtotals to expandable round-history records
- Added a Settings & Sharing toggle for round-history card sprites
- Replaced the small fullscreen direction pill with a large, labelled UNO-style clockwise/counter-clockwise direction card

## Version 6.0 additions

- Added Host, Controller, Player and Viewer roles with a clear role badge on every connected device
- Made Reverse Direction universally available through validated, immutable Firebase commands with cooldown and duplicate protection
- Added protected-action requests, a host Pending Actions queue, approval/rejection, stale-request expiry and destructive-action confirmation
- Added per-device capabilities for scoring, starter, timer, history and game management
- Added a bounded live activity log for commands, requests, decisions, permission changes and host transfer
- Added explicit host transfer, reconnect-safe listener cleanup and safe waiting while the host is offline
- Extended the Firebase room schema and security rules without allowing collaborators to write authoritative game state directly

See `CHANGELOG.md` for the release summary, `CURRENT-STATE-v5.1.md` for the pre-v6 architecture audit, and `ROADMAP.md` for the original multi-device controller design.

## v4.7 data migration

On first v5 load, the app reads `uno-score-tracker-v5-current` or falls back to the existing `uno-score-tracker-v4` record. It converts string player profiles to profile objects, expands legacy round entries, computes a score baseline so existing totals remain unchanged, assigns a stable local game id, and writes v5 data under new keys. The v4 record is retained as a recovery copy. Corrupt JSON is ignored and replaced with validated defaults without preventing startup.

## Data model summary

The active game is the authoritative model for names, scores, score baseline, direction, starter, rules, history, timer and settings. Round edits and deletions recompute scores from `scoreBaseline + round changes`; statistics are derived from round history rather than maintained as competing counters. Firebase hosts synchronize a bounded v6 DTO while profiles and the saved-game library remain local. Collaborative commands and requests carry the expected game revision and are applied once by the host.

## Known operational assumptions

- A Firebase live room has one authoritative host. Unexpected host loss leaves commands and requests waiting safely; automatic host election is intentionally not attempted. Use explicit transfer before the host leaves when possible.
- Room codes locate rooms but are not passwords. Firebase rules and anonymous authentication are the security boundary.
- Browser local storage is finite and device-local. The app caps the saved library at 100 games and Firebase history at 200 rounds.
- Wake Lock, Web Share, vibration and clipboard behavior depend on browser support and permission policy.
- QRCode.js and Firebase are CDN-loaded and runtime-cached after a successful fetch; a completely fresh offline install cannot start live mode.

## Release checks

Before deployment, validate and publish `firebase-database-rules.json`, then test a host, player/viewer and granted controller in separate browser profiles. The static project has no build step. Existing deployed v5 rules must be replaced before v6 collaborative writes will work.
