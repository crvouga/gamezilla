# Multiplayer shared availability

The contract is [matched-game-interruption](../../specs/games/matched-game-interruption.feature).
Trusted hosts enqueue `MultiplayerAvailability` with `enqueueMultiplayerAvailability`;
the registered server consumer applies it under the same owner locks as moves.
This is a server outbox event, never a client mutation. As with the
[room host boundary](../../pkgs/room-root-server/README.md), a host must await
the committed fence before stopping work. Device disconnection emits no pause.

`paused_at_ms` retains the pause boundary. Remaining time is read at that
boundary; returning shifts the original clock origin by the interruption's
duration. This also retains the separate first-move allowance. Existing due
events re-read the current game and cannot flag a paused clock. The normal
game save publishes projections and schedules resumed deadlines; completed
games keep their result and rating. No timestamp or outcome is inferred from
an unannounced process failure.
