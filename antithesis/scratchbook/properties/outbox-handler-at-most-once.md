# outbox-handler-at-most-once

Focus: Idempotency and Replay.

## Property (catalog draft)

A given `(event_id, consumer_id)` outbox delivery runs its handler at most once per successful processing. Concurrent drains (mutation-path + cron + notification actions) must not both execute the handler for the same unprocessed row. After `processed_at` is set, a later drain is a no-op for that pair.

## What led here

SUT analysis: `claimDueDeliveries` is `SELECT` without `FOR UPDATE` / `SKIP LOCKED`. Comment in drain: “single Worker drain.” Cron opens a **second** DB session (`drainOutboxOnCron`) and request-path drain runs after `/mutations` and from notification routes. Two isolates can both select the same due rows.

This is at-least-once delivery without an exclusive claim. Product consumers write `notifications` and then `notifyChannels` (pushSeq allocate + EMQX).

## Code paths

- `pkgs/outbox/src/drain.ts`
  - Whole drain is one `db.transaction`.
  - `claimDueDeliveries`: `SELECT event_id, consumer_id, attempts FROM outbox_deliveries WHERE processed_at IS NULL AND deleted_at IS NULL AND available_at <= now ORDER BY available_at LIMIT $n`.
  - No update of `attempts` / lease / `processed_at` at claim time.
  - Handler runs **inside** the same txn; success → `markProcessed` (`processed_at = now`).
  - Failure bumps `attempts` and `available_at` (8 tries, then +365d park).
- `apps/server/src/sync/outbox-drain.ts` `drainAndNotifyOutbox`
  - Registers friends notify consumers; after drain, `notifyChannels` for `notifyUserIds` **only if** `apiRequestAsyncLocalStorage` is set.
- `apps/server/src/server.ts` `drainOutboxOnCron`
  - Own `openRequestDb`; no ALS. After a successful handler, cron **skips EMQX notify** (returns `processed` when `store === undefined`).
- Other drain sites: `create-server.ts` (post-mutations), `notifications/route.ts`.
- Product handlers: `libs/friends/src/root/server/friends-outbox-consumers.ts`
  - `notifications.send` / `deactivate` keyed by source `{ namespace, type, requestId }`.
- `libs/notifications/.../publish-helpers.ts`
  - `INSERT … ON CONFLICT (id) DO UPDATE` with `id = namespace:type:sourceId:userId`.

Sequential second drain is already unit-tested (`outbox.test.ts`: `send` id-idempotent; second `drainOutbox` processes 0). Concurrent claim is not.

## Existing pins

- `pkgs/outbox/src/outbox.test.ts` — single-threaded drain-once. Does not start two overlapping `drainOutbox` transactions.

## Failure if violated

Double `handler` on `friendRequestSentNotifyConsumer`: notification upsert likely still one row (ON CONFLICT), but `updated_at` / payload refresh and a **second** `notifyChannels` allocate another `pushSeq` and publish. Cron+request overlap can mark processed on the cron session and skip notify, or both run the handler.

If a future consumer is not upsert-safe (increment, second insert, email), double-run is user-visible duplication. The property should not depend on friends happening to upsert.

## Antithesis angle

- Overlap cron `scheduled` with a `POST /mutations` that also drains (two SQL sessions, READ COMMITTED).
- Pause after both SELECTs and before `markProcessed`.
- After one success, confirm a third drain does not increment a handler-side counter (workload instrumentation or SUT `Reachable` on handler entry count).

## Instrumentation

No Antithesis SDK (`existing-assertions.md`). Missing:

- `Always`: for each `(event_id, consumer_id)` with `processed_at` set, handler success count is 1.
- `Always`: `notifications` live row count per `(user_id, source_*)` stays 1 after overlapping drains (weaker, friends-specific).
- `Reachable`: two drain transactions selected the same due row (the race fired).
- `Unreachable`: handler invoked after `processed_at` is already set in a committed snapshot.

SUT-side counter on `runDelivery` / consumer `handler` is the useful search hint; HTTP 200 on both drains is not enough.

## Open questions

- Is the intended contract exclusive at-most-once delivery, or at-least-once with idempotent handlers? `(needs human input)`

### Investigation Log

#### Does claim take a row lock or lease?

- Examined: `drain.ts` `claimDueDeliveries`, `markProcessed`, `failDelivery`; cron vs request drain; friends consumers; notifications upsert.
- Found: portable SELECT then later UPDATE. No `FOR UPDATE`, `SKIP LOCKED`, or claim-time `attempts` bump. Two READ COMMITTED txns can both see `processed_at IS NULL`. Friends `send` is ON CONFLICT by deterministic id. Cron drain has no ALS → `notifyChannels` skipped even when the handler ran.
- Not found: a second claim implementation for Postgres-only.
- Conclusion: exclusive claim is not implemented. Property tests the comment’s “runs consumer once” claim. Tagged partial on *intent* (at-most-once vs at-least-once+idempotent) because only the comment and upsert side-effect speak to it — both are consistent with “we hoped one isolate.”

- Re-investigation 2026-09-01. Examined: `claimDueDeliveries` comment (“select then bump attempts in the same tx”); `markProcessed` / `failDelivery`; `apps/server/wrangler.toml` `crons = ["*/1 * * * *"]`; `drainOutboxOnCron` vs post-`/mutations` drain; friends `ON CONFLICT` upsert.
- Found: the comment’s “bump attempts” at claim time is stale — SELECT does not bump `attempts` (only `failDelivery` does). Cron and request drains are two SQL sessions against the same Postgres even if Cloudflare uses different isolates. Product handlers happen to be upsert-safe; the drain API does not require that.
- Not found: an owner doc or test that says double-handler is accepted. Sequential second drain is tested; overlapping drains are not.
- Conclusion: still `(needs human input)` on intended contract. Implemented behavior is at-least-once (unlocked SELECT). Claimed comment is single-Worker once. Property stays testing handler-at-most-once; if the owner accepts at-least-once+idempotent, this Always becomes a false positive.

## Synthesis merge (orchestrator)

Also covers: `outbox-unlocked-double-claim`. Unlocked SELECT + cron-without-ALS is the mechanism. Handler-at-most-once is the safety half; `outbox-processed-without-notify` remains a separate liveness property.

SDK (`existing-assertions.md`): **missing**. Suggested Always / Reachable / Unreachable are new.
