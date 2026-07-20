# Suggested v7.1 / v8 roadmap

## v7.1 — trusted multi-device controls

The strongest next addition is controlled co-hosting rather than making every viewer editable.

- Add three room roles: `host`, `controller`, and `viewer`.
- Let a viewer request controller access; require the host to approve and revoke it.
- Grant capabilities separately: reverse direction, choose starter, timer control, and submit round scores.
- Keep the host authoritative. Controllers send small commands with unique ids; the host validates and applies them to the canonical game state.
- Display who performed every action in an audit trail and provide Undo for the host.
- Use Firebase transactions or a command queue to reject duplicates and stale commands.
- Show role and connection state clearly on every device, including when the host is offline.

This is suitable for v7.1 because it extends the existing live-room model without changing scoring semantics.

## v8 — collaborative table mode

- Allow each player to claim a player profile/seat after host approval.
- Let players propose their own remaining-card total while the round winner or host confirms the round.
- Add optional turn indicator and per-device “UNO”/status controls without storing private hand contents.
- Add reconnect-safe device identity, expiring controller grants, host transfer, and recovery when the original host disappears.
- Add a room activity log, conflict UI, rate limits, and Firebase App Check before enabling broader write access.
- Consider private-room PINs or invitation tokens if rooms will be used beyond trusted people at the same table.

## Recommended Firebase shape

```text
rooms/{roomId}
  hostUid
  controllers/{uid}/capabilities
  seats/{playerId}/uid
  commands/{commandId}
    uid
    type
    payload
    expectedRevision
    createdAt
  game
    revision
    ...canonical state
  audit/{eventId}
```

Security rules should allow controllers to create only commands permitted by their capability record. They should not be allowed to write `game` directly. The host validates commands, updates the game revision, and records the audit event atomically.
