# v6.0.0 verification record

## Automated/static checks

- Parsed `manifest.json` and `firebase-database-rules.json` as JSON.
- Ran JavaScript syntax checks for `app.js`, `v5-features.js`, and `live-sync.js` using Node.js.
- Confirmed every local service-worker asset exists and the v6 cache names are unique.
- Confirmed release identifiers in `VERSION`, metadata, footer, README, changelog, and service worker are 6.0.0.

## Manual browser checks

- Loaded the app over local HTTP and confirmed the complete standalone UI renders without startup errors.
- Awarded a five-point round and confirmed Player 1 became 5, Round History recorded one round, and totals recalculated.
- Started the game timer, allowed it to advance, paused it at one second, and confirmed Resume Timer state.
- Reversed direction and confirmed the accessible direction label changed to COUNTER-CLOCKWISE.
- Reloaded the page to verify current-game score, history, timer, and direction persistence.
- Confirmed the footer reports v6.0.0 and the service worker serves the updated application shell.

## Multiplayer review

- Reviewed the command/request/processed-marker paths for immutable submission, host-only application, revision checks, expiry, deduplication, listener cleanup, host-offline waiting, and explicit host transfer.
- Reviewed the rules for host-authoritative game writes, self-owned member/presence records, immutable authenticated command/request creation, host-only reviews, validated records, and room-code transfer.

## Deployment-dependent checks

End-to-end Firebase testing requires the project owner to publish `firebase-database-rules.json` and use a permitted production/test origin. After deployment, repeat the host/player/viewer/controller, two-device simultaneous Reverse, request approval/rejection, permission revoke, host transfer, host disconnect/reconnect, and refresh tests in separate browser profiles.
