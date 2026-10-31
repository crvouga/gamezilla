# Room game API

Turn-based and real-time games share one `RoomModule`: initial state,
command decisions, and event reduction. Hosts, clients, adapters and the
deterministic harness consume that same module. Product behavior is specified
in [`specs/room`](../../specs/room/); this document describes implementation.

## Define the rules

Import `defineRoomModule` from `@pkgs/room-root-shared-ts/module`.
Its `RoomDefinition` requires four members:

| Member | Responsibility |
| --- | --- |
| `name` | Validated lowercase kebab-case routing name |
| `initialState()` | Serializable, namespaced attribute map |
| `handle(state, command, identity)` | Accept with events and optional effects, or refuse with a room error |
| `reduce(state, event)` | Deterministically apply a committed fact |

The returned module supplies canonical `hashRoomState` hashing and empty
effect recovery by default. Supply `recoverEffects(state)` whenever the
game schedules deadlines or has other recoverable effects; it must preserve
the original deadlines. Supply `hash` only for an intentional domain projection.
Neither definition nor client prediction instantiates an authoritative runtime.

Commands contain an idempotency key, timestamp and typed Message payload.
The server stamps the authoritative timestamp. `handle` and `reduce` remain
pure and synchronous, so the same rules support prediction, replay and host
decisions. Turn deadlines use Schedule/CancelSchedule effects and ordinary
commands; a turn-based game needs no continuous loop.

## Optional authoritative execution

Use `createRuntime(ports)` for transient controls, continuous simulation, or
other host-owned execution. The factory returns `RoomRuntime<State, Command,
Identity>`. Implement only the hooks needed by the game:

| Hook | Responsibility |
| --- | --- |
| `receive(command, identity, actor)` | Validate a transient input; return a room error or `null` |
| `update(state)` | Observe hydrated state and subsequent committed changes |
| `presence(actors)` | Observe connections, including multiple devices per person |
| `project(state)` | Include current simulation progress in the next durable decision |
| `recover(state, payload)` | Validate a bounded checkpoint and produce an ordinary trusted command |
| `dispose()` | Release timers and other owned resources |

The host creates one runtime per room instance, provides current presence
before its first state update, and disposes it on replacement or shutdown.
Clients never create it. A runtime without `receive` refuses transient inputs.
There is one owner of inputs: the module's runtime, rather than a second
host-level handler configuration.

`RoomRuntimePorts<Command>` provides injected `clock` and `timers`, `publish`
for optionally audience-restricted signals, `checkpoint` for a bounded
recovery value, `commit` for trusted commands, `enqueue` for serialized work,
and `onError`. Timers are required only when execution actually uses them.
Every durable runtime decision goes back through the module's ordinary
command handler and storage path.

Runtime hooks run on the room's serial chain. `commit` queues subsequent
work on that chain: start it and handle its rejection, but do not await it
inside `receive`. Timer callbacks enter through `enqueue`; do not mutate
authoritative state concurrently with room commands. Recovery checkpoints
are accepted only against the current log tip and validated by `recover`.

## Delivery and persistence

`RoomClient.dispatch` predicts and durably queues commands, with server
deduplication and event replay after reconnect. `sendSignal` sends transient
controls only while synchronized: no offline queue, event log or durable
dedup entry. `subscribeSignal` observes transient snapshots on the same
authenticated transport. Games own any sequence/acknowledgment protocol
inside their signal payloads.

These delivery guarantees stay distinct. Continuous games use signals and
bounded checkpoints for high-frequency progress and ordinary commands for
durable decisions. Both paths share room authorization and membership.
Storage and wire formats are unchanged by the authoring API.

## Package boundaries

`types` contains protocol/domain types, `module` defines games, and `runtime`
defines optional execution. `builtin` contains schedules; `handler` defines
custom effect delivery. Client, server, harness and platform adapters live
in their respective room packages and expose explicit subpaths in their
manifests. Internal implementation files are not automatically exported.

The common example is
[`game-room.ts`](../room-root-harness-ts/src/game-room.ts). Harness usage and
deterministic conformance checks are documented in the
[`room harness`](../room-root-harness-ts/README.md).
