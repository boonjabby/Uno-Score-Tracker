# UNO Direction & Score Tracker

A lightweight, installable Progressive Web App for tracking play direction, calculating cards left in losing hands, and keeping UNO scores.

## Features

- Works offline after the first visit
- Installable on Android, iPhone, iPad and desktop
- Direction tracker with vibration feedback on supported devices
- Card-point calculator with UNO-style card sprites
- Presets for Classic, Teams, Flip, All Wild, Flex and Show 'Em No Mercy
- Editable player/team names, scores, target score and card values
- Automatic local saving
- Round history (last 50 rounds)
- Light and dark modes
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

### About multiplayer and camera recognition

The current GitHub Pages build is fully static. Cross-device live multiplayer requires a realtime backend such as Firebase or Supabase, and automatic camera card recognition requires a trained computer-vision model. Those features are intentionally not faked in this release. The Share Snapshot button transfers the current direction, names and scores without a server.


## Live cross-device viewer mode (v4)

Live mode uses Firebase Authentication (anonymous accounts) and Firebase Realtime Database. The host has write access; viewers are read-only. A QR join link and a six-character room code are both provided.

### One-time Firebase setup

1. Create a Firebase project at the Firebase Console.
2. Add a **Web app** to the project and copy its configuration into `firebase-config.js`.
3. Open **Authentication → Sign-in method** and enable **Anonymous** authentication.
4. Create a **Realtime Database**. Do not leave it in public test mode.
5. Open the database **Rules** tab, paste the contents of `firebase-database-rules.json`, and publish the rules.
6. Commit `firebase-config.js` to GitHub and wait for GitHub Pages to redeploy. Firebase Web configuration identifiers are public by design; the security boundary is Authentication plus the published database rules.

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
