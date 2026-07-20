# v5.1.0 pre-v6 architecture audit

This document records the complete multiplayer-relevant state of v5.1.0 before collaborative controls were added.

## Application structure and version

The supplied release is v5.1.0. It is a static, dependency-light PWA with `index.html`, `styles.css`, classic-script `app.js`, classic-script `v5-features.js`, module `live-sync.js`, Firebase configuration/rules, service worker, manifest, icons, documentation, and a GitHub Pages workflow. Firebase 12.16.0 and QRCode.js are CDN-loaded. There is no build step or permanent user account.

`app.js` owns the mutable authoritative local game state. It includes schema/id/title/timestamps, direction, players and scores, card calculator state, newest-first round history, theme/sound/settings, profiles, starter, score baseline, legacy statistics, undo state, winner state, and timestamp-based game clock. Game type, participant count, target, and card values are also reflected in DOM controls. `v5-features.js` normalizes history/profiles, derives statistics, manages saved games, renders expanded history/profiles/winner/fullscreen views, and migrates v4 data.

## Existing controls

The host/standalone UI can edit player names/scores, award calculated rounds, edit/delete/undo history, select a random starter, reverse direction, start/pause/resume/reset the timer, reset/end a game, change card rules/settings, and use fullscreen scoreboard. Viewer mode disables protected controls. v5.1 has no player/controller role, no request workflow, no capability assignment, no activity audit, and no host transfer.

## Firebase schema

```text
rooms/{roomId}
  hostUid
  code
  createdAt
  updatedAt
  game
  presence/{uid}
    role: host | viewer
    connectedAt

roomCodes/{code}
  roomId
  hostUid
  createdAt
```

The full game DTO is host-written and viewer-read. It contains version 5, game identity/configuration, direction, names, scores, history, starter, score baseline, settings, winner/completion state, and timestamp-based clock.

## Authentication, presence, roles, and reconnect

Firebase anonymous auth is created on demand. The room creator is the only game writer and is identified by `hostUid`; all other joined devices are read-only viewers. Each device writes only its own presence record and schedules `onDisconnect().remove()`. The room listener is removed before replacement and on page hide/leave. A saved `uno-live-session-v1` record restores room id/code/role for up to seven days; the app checks room freshness and host ownership. A disconnected host's presence disappears, viewers show a waiting message, and authority is not silently transferred. There is no explicit transfer operation.

## Live synchronization and timer

Host changes are debounced 180 ms, client-validated for basic array bounds, and written as one game update plus server timestamp. Viewers apply remote game snapshots. Firebase `.info/serverTimeOffset` corrects timer drift. Clock state uses accumulated milliseconds plus an absolute start timestamp; rendering intervals never act as the time source. Entering/leaving live mode rebases the timestamp to avoid clock jumps.

## Local storage

- `uno-score-tracker-v5-current`: current canonical local game.
- `uno-score-tracker-v5-games`: up to 100 automatic saved-game snapshots.
- `uno-score-tracker-v5-profiles`: local profile objects.
- `uno-score-tracker-v5-migrated`: migration marker.
- `uno-section-state-v1`: collapsible section states.
- `uno-live-session-v1`: active room reconnect information.
- v4/v3/v2/v1 keys are read as migration fallbacks and retained for recovery.

Corrupt JSON is skipped; corrupt current data is backed up where possible. Legacy histories are expanded into complete round records and score baselines preserve old totals.

## Validation and security rules

Global Firebase reads/writes are denied. Any authenticated user who knows a room can read it. Only the current `hostUid` can write the room/game and code mapping. Each authenticated device can write its own presence. Rules validate room/code formats, game type/count/target, bounded names/scores/history, and timer shape. They do not model members, commands, requests, permissions, processing idempotency, activity, or host transfer.

## Service worker

The v5.1 service worker uses `uno-tracker-v5.1.0` and runtime cache `uno-tracker-runtime-v5.1`. It precaches core same-origin assets/documentation, deletes only obsolete `uno-tracker-*` caches, uses network-first navigation with offline shell fallback, and cache-first/background-refresh behavior for other GET requests. CDN responses are runtime cached after first successful fetch.

## v6 compatibility constraints

- Preserve the `rooms/{roomId}/game` authoritative DTO and v5 local-storage schema.
- Extend rooms with members, permissions, requests, commands, processed markers, and bounded activity rather than replacing rooms.
- Keep v5 viewers compatible as read-only consumers where practical. v5 hosts cannot process v6 commands, so collaborative actions require a v6 host.
- Keep anonymous auth/presence/reconnect and timestamp clock semantics.
- Never allow members to write authoritative game state directly.
