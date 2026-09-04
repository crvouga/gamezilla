# room-single-log-per-topic

Focus: Distributed Coordination. The room plane has **no Raft**. Production
“single writer” is Cloudflare `idFromName(topic)` → one Durable Object
isolate per `space:{id}`. Split-brain is what happens if two room
processes persist the same topic independently — likely in an Antithesis
topology that is Node + sidecar `RoomServer`, not live CF.

## Why this property

Live play is a separate event log (`@pkgs/room` +
`RoomServerDurableObject`). Wire `v=1`, monotonic `seq` per topic,
`commandId` dedup, `RoomModule.hash(state)`. Persistence keys
`room.do.v3.*`. Sim uses in-process `RoomServer` — no WS, no DO
(`sut-analysis` fidelity gap).

Gateway (`apps/server/src/room/route.ts`) **never blocks on auth**. It
forwards Upgrade to `ns.get(ns.idFromName(topic))`. That name-to-isolate
map is the entire consensus story. Two Node room processes with local
SQLite/memory, both accepting `topic=space:{id}`, will each append a
log. Clients that bounce between them see divergent hashes and seq
holes.

## Code paths

| Path | Role |
|---|---|
| `apps/server/src/room/route.ts` `createRoomApp` | `stub = ns.get(ns.idFromName(topic))` (line 59). Missing ROOM binding → 503. |
| `pkgs/room/src/server/adapters/durable-object/adapter-base.ts` | Restore/create under `blockConcurrencyWhile`. `webSocketMessage` is **not** wrapped. `storageChain` + per-connection `commandChains`; both `.catch(() => undefined)`. |
| `pkgs/room/src/server/adapters/durable-object/storage-keys.ts` | `room.do.v3.${scope}`. |
| `pkgs/room/src/server/core/room-server.ts` | `storageChain` serializes welcome/commit/inject (line 171). |
| `pkgs/room/src/sim/invariants.ts` | `log-seq-contiguity`, `live-vs-log` (`module.hash` vs fold), `command-id-dedup-stable`. Client hash equality only at settle after heal. |
| DO `alarm()` | Recreates servers after eviction (`sut-analysis` liveness). Wall-clock, not `SimClock`. |

Take-over: same `(identity, clientId)` closes the prior socket **4000**.
That is connection uniqueness, not log uniqueness.

## Failure scenario

**Production-shaped (one DO):** clients reconnect across partition; each
does `sync(fromSeq)`. **Bug if** live hash ≠ fold of contiguous log, or
`commandId` applies twice, or seq skips/duplicates.

**Antithesis-shaped (two room processes):** API round-robins or a
restart spins a second `RoomServer` without shared DO storage.
Clients A and B commit on different processes. **Bug if** both
acknowledge commands and later a client observes two hashes for
`space:{id}`. That is split-brain.

**Hibernation:** isolate evicted, `ensureRestored` rebuilds sockets.
Swallowed `storageChain` errors (`sut-analysis` A3) can leave memory
ahead or behind storage.

**Auth fallback during partition:** bearer resolve throws (DB hiccup) →
actor becomes `anonId` (`resolveRoomActorId`). Runtime checks see the wrong
identity. Coordination bug adjacent to split-brain: two “hosts.”

## Partition / heal instrumentation (SUT)

All **missing**. Critical because topology, not product code, creates
the second writer:

- Emit `room.process_id` + `topic` + `log_head_seq` +
  `RoomModule.hash(state)` on every commit and on welcome.
- `Always("room.single_writer.one_process_per_topic")` — at most one
  live process_id has committed to a topic during a quiet interval. If
  the harness **intentionally** runs two processes, this Always failing
  is the split-brain detector (or treat dual-process as
  `Unreachable` in a single-writer topology).
- `Always("room.live_equals_log_fold")` — port `live-vs-log`. Safe
  mid-fault on the **server** log; client hash only after WS heal +
  `sync(fromSeq)`.
- `Always("room.log_seq_contiguous")` — port `log-seq-contiguity`.
- `Sometimes("room.reconnect.sync_from_seq")` after a WS drop +
  successful catch-up.
- `Reachable("room.auth.fallback_to_anon")` on bearer-fail path
  (interesting, not necessarily illegal).
- Partition/heal: cut WS/TCP to the room process independently of
  sync HTTP and of EMQX. Heal = new WS + `sync(fromSeq)`. Do not use
  sim mesh; `fidelity: max` still uses in-process rooms.

If the deployment template runs a **single** room container with
sticky `topic → process`, document that as the invariant’s
environment assumption. Adding a second replica without shared
storage **is** the fault.

## Existing assertions

Room DST invariants in `pkgs/room/src/sim/invariants.ts` are oracles
to port. **Missing** as Antithesis SDK. No probe of “how many room
processes accepted this topic.”

## Key observations

- Sync LWW and room log are different merge theories. Do not assert
  space-metadata LWW with `hash(state)`.
- Gateway constructing `Request` wrong strips Upgrade → 426
  (`cloudflare.d.ts` / route comment). That is availability, not
  split-brain.
- Heartbeat 20s / pong miss 8s vs wall-clock jump (`sut-analysis` A13)
  can flap sockets without creating a second log — unless reconnect
  lands on another process.

## Open questions

- Will a later Antithesis topology run two room processes (or a
  restart that loses disk and accepts a new empty log)? `(needs human input)`

### Investigation Log

#### Will the first Antithesis topology run one `RoomServer` or two?

- Examined: `antithesis/scratchbook/deployment-topology.md` (containers, “No separate room container”, dual-room deferred).
- Found: first campaign is one `api` replica with in-process `createRoomServer`. Dual-room-process variant is explicitly deferred. `Always` “one process_id per topic” is the single-writer assumption; split-brain is `Unreachable` in that topology unless a restart loses storage and accepts a new empty log.
- Not found: a compose file that already starts a second room replica.
- Conclusion: resolved for the first topology (one writer). Remaining question is whether a later campaign adds a second process — tagged `(needs human input)`.

#### Does in-process sim `createRoomServer` ever register the same topic twice in one process?

- Examined: `apps/room-server/src/app/create-room-server.ts` `getOrCreate` / `createTopicEntry` / `replaceTopic` / `dropTopic`; `sim/console` `createRoomServer` call sites.
- Found: `topics` is a `Map<string, TopicEntry>`. `getOrCreate` returns the existing entry. `replaceTopic` hydrates that same server. One `RoomServerApp` never holds two servers for `space:{id}`. `dropTopic` then `getOrCreate` is a new empty log (restart-with-empty-disk inside one process), not two concurrent writers.
- Not found: a sim path that constructs two `RoomServer` instances for the same topic in one `RoomServerApp`.
- Conclusion: resolved — in-process split-brain is not cheaper than two containers. Two `createRoomServer()` instances would be the two-process case.

SDK (`existing-assertions.md`): **missing**. Room DST invariants in `pkgs/room/src/sim/invariants.ts` are oracles to port, not Antithesis assertions.
