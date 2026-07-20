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

## Opening on Chrome

'(https://boonjabby.github.io/Uno-Score-Tracker/)'

## Install on a phone

### Android
Open the published address in Chrome, then choose **Install app** or use the app's Install button.

### iPhone/iPad
Open the published address in Safari, tap **Share**, then **Add to Home Screen**.

## Development notes

This project intentionally uses plain HTML, CSS and JavaScript. There is no build step or dependency installation. Change the cache name in `service-worker.js` whenever publishing a release that must invalidate older cached files.

## Trademark note

This is an unofficial companion tool and is not affiliated with or endorsed by Mattel. UNO is a trademark of its respective owner. The card graphics are original CSS-style representations rather than official artwork.
Deployment trigger
