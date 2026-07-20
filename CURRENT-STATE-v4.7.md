# v4.7.0 architecture audit

This audit was completed before v5.0.0 implementation. It describes the supplied v4.7.0 project rather than the v5 design.

## Project shape

The application is a dependency-light static PWA: `index.html`, one stylesheet, classic-script `app.js`, module `live-sync.js`, Firebase configuration and rules, a service worker, web manifest, two PNG icons, README, licence, version file, and a GitHub Pages deployment workflow. QRCode.js and Firebase 12.16.0 are loaded from CDNs. There is no build step.

## Application state

`app.js` owns one mutable `state` object with:

- `clockwise`
- `names` and `scores`
- calculator data: `activeCards`, `selected`, and `cardHistory`
- `history`, stored newest first and capped at 50 rounds
- appearance/settings: `theme` and `sound`
- simple string `profiles`
- incrementally maintained `stats`
- transient `undoStack`
- `winnerRecorded`
- `gameClock: { elapsedMs, running, startedAt }`

Game type, participant count, target score, and active card values are partly represented by DOM controls rather than entirely inside `state`. A live-game DTO is assembled separately by `getLiveGameState()`.

Round records contain `id`, winner name, awarded points, selected-card summary, and ISO timestamp. They do not contain every player's delta/resulting total, round number, or duration. Scores and lifetime statistics are mutated independently, so editing/deleting history cannot safely recalculate them.

## Local storage

- `uno-score-tracker-v4`: current game, settings, profiles, incremental statistics, and timer. `saveState()` writes it after most meaningful changes.
- `uno-section-state-v1`: remembered `open` state for collapsible `<details>` sections.
- `uno-live-session-v1`: Firebase room id, room code, and host/viewer role for reconnect.
- Migration fallbacks read `uno-score-tracker-v3`, `v2`, and `v1`. Corrupt current/legacy JSON is removed and the app starts fresh.

There is no saved-game library, active-game id, profile object schema, or explicit migration marker.

## Timer

The timer stores accumulated `elapsedMs`, boolean `running`, and absolute `startedAt`. Rendering uses a 500 ms display interval but elapsed time is derived from timestamps, not tick counts. Pausing folds the current delta into `elapsedMs`; resume sets a new `startedAt`; reset clears all three fields. In live mode, `live-sync.js` listens to Firebase `.info/serverTimeOffset` and exposes a corrected `serverNow()`. Timer rebasing prevents jumps when entering/leaving live mode. Viewers receive the host's base and absolute start timestamp.

## Firebase data and rules

Realtime Database layout:

```text
rooms/{32-hex-roomId}
  hostUid
  code
  createdAt
  updatedAt
  game
  presence/{anonymousUid}
    role: host | viewer
    connectedAt

roomCodes/{6-character-code}
  roomId
  hostUid
  createdAt
```

Global reads/writes are denied. Any authenticated anonymous user can read a known room or room-code mapping. Only the room creator can write the room and its code mapping. Each authenticated device can write/remove only its own presence record. Validation checks host uid, code format, room-id format, presence shape, and only a minimal set of game children; it does not deeply validate names, scores, history, timer, lengths, timestamps, or unknown fields.

## Live synchronization

`live-sync.js` anonymously authenticates on demand, generates a cryptographically random room id and six-character code, creates/joins rooms, publishes presence using `onDisconnect().remove()`, renders local QR codes, and persists reconnect details. The host is the only game writer; viewers apply room snapshots through `applyLiveGameState()` and the UI is made read-only with a viewer-mode body class. Host changes are debounced 180 ms before writing the complete game DTO.

`subscribe()` removes the previous room listener before adding another. `resetUi()` removes that listener and cancels the presence on-disconnect registration, but the global auth and server-offset listeners remain for app lifetime. The host explicitly deletes the room and code mapping when ending. Unexpected host disconnection leaves the room readable and stale because no host lease/status is maintained.

## Fullscreen, presence, reconnect, and viewer behavior

Fullscreen scoreboard is a CSS body mode toggled from live-room controls; it hides editing sections and enlarges direction, timer, and score rows. It does not show starter, round, device count, or optional QR in the scoreboard itself. Presence count is derived from the room's presence map. Saved live sessions reconnect after refresh if the room still exists and a saved host still owns it. Viewers are read-only through pointer-event suppression and reduced opacity.

## Service worker and metadata

`service-worker.js` uses cache `uno-tracker-v4.7.0`, precaches same-origin core files/icons, deletes every cache whose name does not exactly match on activation, claims clients, supports `SKIP_WAITING`, and uses cache-first with background network refresh. Failed navigation-like requests fall back to cached `index.html`. Firebase and QR CDN modules are not explicitly precached. `manifest.json` declares a standalone portrait PWA, theme/background colours, and maskable 192/512 icons; it has no explicit application version field.

## Key v5 migration constraints

- Preserve v4.7's DOM-driven game configuration while moving persisted/live data to a validated canonical schema.
- Convert string profiles to profile objects.
- Convert newest-first legacy history into complete round records and derive a score baseline so existing totals are preserved.
- Keep timestamp-based timer semantics and Firebase server offset.
- Avoid duplicating room listeners and clean all session-scoped listeners/handlers.
- Preserve current keys long enough to recover/migrate, then write v5 keys without destructively deleting user data.
