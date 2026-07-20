# Changelog

## 6.0.0 — 2026-07-20

- Added host-authoritative collaborative multiplayer controls with Host, Controller, Player and Viewer roles.
- Added universal Reverse commands, protected-action requests, host approval/rejection and per-device capability grants.
- Added duplicate processing protection, revision checks, request expiry, command cooldowns and validated bounded Firebase records.
- Added a live activity log, explicit host transfer and safe host-disconnected waiting/reconnect behavior.
- Updated Firebase Realtime Database rules, PWA metadata, cache names and architecture documentation.
- Corrected Realtime Database rules syntax by replacing unsupported child-count calls with bounded child-key validation and using an explicit Boolean comparison for the running timer.
- Fixed permission-denied errors for Reverse and no-argument requests after Firebase removes empty `payload` objects.
- Clarified that Player and Viewer are descriptive device labels with identical request rights; host-granted Controller permissions determine direct action access.

## 5.1.0 — 2026-07-20

- Fixed immediate Saved Players lifetime-stat refresh and expanded the profile summary to points, rounds, games and wins.
- Added optional card sprites and point subtotals to each round-history entry.
- Added a large, unmistakable labelled direction card to fullscreen scoreboard mode.

## 5.0.0 — 2026-07-20

- Added editable, deletable, undoable round history with per-player deltas, totals, timestamps, round numbers, and durations.
- Added automatic saved games with resume, rename, duplicate, and delete controls plus v4.7 migration.
- Added history-derived player/game statistics and richer local player profiles.
- Redesigned fullscreen scoreboard with starter, direction, round, timer, presence, and optional QR.
- Added winner results, rematch, result sharing, reduced-motion, high-contrast, vibration, and explicit system/light/dark themes.
- Hardened live listener cleanup, reconnect state, state validation, offline messaging, and Firebase Database rules.
- Updated PWA metadata, cache lifecycle, documentation, and versioning.

Earlier changes are documented in `README.md`.
