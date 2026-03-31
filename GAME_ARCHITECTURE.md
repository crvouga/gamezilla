# Game Architecture — Leaderless Consensus + Smart Clients

## Philosophy

**Smart clients, dumb servers.** All game intelligence lives in shared client code. Servers are stateless dumb relays — they move bytes, nothing else. This follows the end-to-end principle from original internet architecture: intelligence belongs at the endpoints, not in the network.

```
Dumb relay boxes     → clients route via consistent hashing
Dumb pub/sub broker  → clients handle consensus
Dumb event log       → clients replay and reconstruct state
```

---

## Core Primitive — GameModule

```typescript
type GameModule<TState, TCommand, TEvent> = {
  initialState(): TState;
  handleCommand(input: { state: TState; command: Command<TCommand> }): Result<{ events: TEvent[] }, GameError>;
  handleEvent(input: { state: TState; event: TEvent }): TState;
}
```

Three methods. All pure functions. No side effects. Runs identically on client, referee, and optional server.

### Rules

- `handleCommand` is the **only** source of events — ever
- `handleEvent` is the **only** way to produce new state — ever
- UI dispatches commands, never events
- State is always derived, never mutated directly

### Derived utilities

```typescript
// reduce is just handleEvent folded over a list — not part of the interface
function reduce<TState, TEvent>(
  module: GameModule<TState, any, TEvent>,
  events: TEvent[],
): TState {
  return events.reduce(
    (state, event) => module.handleEvent({ state, event }),
    module.initialState(),
  );
}
```

### Command shape

```typescript
type Command<TCommand> = {
  id: string;       // for consensus dedup (ulid)
  seq: number;      // for ordering
  playerId: string; // for turn validation
  payload: TCommand;
}
```

### One command produces multiple events

```typescript
// MOVE_PIECE command might produce:
[
  { type: 'PIECE_MOVED', from, to },
  { type: 'PAWN_PROMOTED', piece: 'QUEEN' },   // if applicable
  { type: 'CHECK_DECLARED', kingSquare: 'e8' }, // if applicable
  { type: 'GAME_ENDED', result: 'WHITE_WINS' }, // if checkmate
]
```

---

## CQRS Discipline

```
Commands  — user intent, dispatched by UI, validated by handleCommand
Events    — facts, produced only by handleCommand, applied by handleEvent
State     — derived, never mutated directly, always from handleEvent
UI        — reads state, dispatches commands, never produces events
```

```
UI ──► handleCommand ──► events ──► handleEvent ──► state ──► UI
```

### Topics

```
games/{gameId}/commands   ← players publish (intents)
games/{gameId}/votes      ← all peers publish (ACK/REJECT)
games/{gameId}/events     ← committed facts (immutable)
games/{gameId}/presence   ← connection lifecycle
```

Clients never publish to `events`. Events are only published after quorum is reached.

---

## Consensus Model — Leaderless, Peer Validated

### Participants — exactly 3, first class

```
Player A  — makes moves, validates peer moves
Player B  — makes moves, validates peer moves
Referee   — first class role in the app, validates all moves, tiebreaker
```

Quorum: **2 of 3**. Any two agreeing commits the move.

### Why the referee exists

Without a referee, Player B can falsely reject Player A's legal move and there is no arbiter. The referee breaks the tie:

```
Player A sends legal move:
  Player B → ACK
  Referee  → ACK
  Result   → COMMITTED (2/3)

Player A sends illegal move:
  Player B → REJECT
  Referee  → REJECT
  Result   → REJECTED (2/3)

Player B falsely rejects legal move:
  Player B → REJECT  ← lying
  Referee  → ACK
  Result   → COMMITTED (2/3), Player B flagged

Referee is corrupt:
  Player B → ACK
  Referee  → REJECT  ← corrupt
  Result   → COMMITTED (2/3), Referee flagged
```

Any single participant can be dishonest. The other two always outvote them. This is Byzantine Fault Tolerance at its minimum viable configuration.

### This model has no canonical name — closest descriptions

- **Leaderless consensus** — no single node has authority
- **PBFT (Practical Byzantine Fault Tolerance)** — closest algorithm, three phases map to commands/votes/events
- **Witnessed consensus with event sourcing** — plain language description

### Game modes

```typescript
type GameMode =
  | { type: 'casual' }      // peer only, works offline, no referee required
  | { type: 'competitive' } // referee required, online only
```

Competitive refuses to start without referee connection. Casual works fully offline.

---

## Complete Flow

```
t=0ms   UI dispatches command
t=0ms   handleCommand validates locally → fast fail before network
t=0ms   Optimistic update → UI updates instantly
t=0ms   Command published to pub/sub box

t=10ms  Player B receives → handleCommand validates → publishes ACK
t=10ms  Referee receives  → handleCommand validates → publishes ACK

t=20ms  Mover receives 2 ACKs → quorum (2 of 3) reached
t=20ms  Mover publishes committed event to games/{gameId}/events

t=30ms  All peers receive event → handleEvent → committed state
t=30ms  Optimistic cleared, UI re-renders with committed state
```

30ms total. One box hop. No server authority.

### On rejection

```
Quorum rejects → rollback optimistic state
             → replay committed events only
             → flag bad actor (voted against majority)
```

---

## Transport — Smart Clients, MQTT Relay

### Broker

MQTT is the relay protocol in all environments. Same client code, same topics, same behavior — only the broker changes.

```
Production:  AWS IoT Core   wss://{account}.iot.{region}.amazonaws.com/mqtt
Local dev:   Mosquitto       mqtt://localhost:1883
```

IoT Core handles TLS and SigV4 auth. Mosquitto is anonymous. Everything above the adapter is identical.

### MQTT Relay Adapter

```typescript
// shared/adapters/mqtt-relay.adapter.ts
import * as mqtt from 'mqtt';

export class MqttRelayAdapter implements PubSubPort {
  private client: mqtt.MqttClient;
  private handlers = new Map<string, Set<(payload: object) => Promise<void>>>();

  constructor() {
    this.client = mqtt.connect(
      process.env.NODE_ENV === 'production'
        ? `wss://${process.env.IOT_ENDPOINT}/mqtt`  // IoT Core
        : 'mqtt://localhost:1883',                   // Mosquitto
      {
        username: process.env.IOT_ACCESS_KEY,        // IoT Core auth
        password: process.env.IOT_SESSION_TOKEN,     // ignored by Mosquitto
      }
    );

    this.client.on('message', (topic, message) => {
      const payload = JSON.parse(message.toString());
      this.handlers.get(topic)?.forEach(h => h(payload));
    });
  }

  async publish(topic: string, payload: object) {
    await this.client.publishAsync(topic, JSON.stringify(payload), { qos: 0 });
  }

  subscribe(topic: string, handler: (payload: object) => Promise<void>) {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
      this.client.subscribe(topic);
    }
    this.handlers.get(topic)!.add(handler);
    return () => this.handlers.get(topic)?.delete(handler);
  }
}
```

### Local dev — Mosquitto via docker-compose

```yaml
services:
  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
      - "9001:9001"   # WebSocket for browser clients
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf
```

```conf
# mosquitto.conf
listener 1883
listener 9001
protocol websockets
allow_anonymous true
```

### Infrastructure

3-5 IoT Core endpoints distributed globally via Route 53 latency routing. No server-to-server communication. No shared state. Pure MQTT relay.

```
IoT Core (us-east-1)
IoT Core (eu-west-1)       ← stateless dumb MQTT brokers
IoT Core (ap-northeast-1)
```

### Deterministic endpoint assignment

Every client independently computes the same IoT Core endpoint for a given game. No coordination, no RPC lookup needed.

```typescript
import ConsistentHashing from 'consistent-hashing';

const ENDPOINTS = [
  'wss://xxx.iot.us-east-1.amazonaws.com/mqtt',
  'wss://xxx.iot.eu-west-1.amazonaws.com/mqtt',
  'wss://xxx.iot.ap-northeast-1.amazonaws.com/mqtt',
];

const ring = new ConsistentHashing(ENDPOINTS);

function getEndpointForGame(gameId: string): string {
  return ring.getNode(gameId); // same answer on every client
}
```

Consistent hashing means adding/removing endpoints only remaps that endpoint's games, not all games.

### Client holds 1 MQTT connection per active game

```typescript
const endpoint = getEndpointForGame(gameId);
const pubsub = new MqttRelayAdapter(endpoint);
```

Player A, Player B, and Referee all hash `gameId` and arrive at the same IoT Core endpoint independently.

### Scaling model

```
IoT Core pricing:
  $0.042  per million connection-minutes
  $0.08   per million messages (5kb chunks)

3 regions   ~$50/month at 10k users    scales to millions of connections
5 regions   ~$100/month at 10k users   consistent hashing distributes load
10 regions  add regions freely         clients auto-route, no config change
```

IoT Core wins vs Ably below ~150M messages/month on ops simplicity. Above that, self-hosted dumb relay boxes on App Runner/EC2 win on flat compute cost (~$360-600/month for 3-5 boxes, ~2.6B messages/month per box).

### Offline / P2P fallback

Same `GameModule`, same consensus protocol, different transport:

```typescript
// online — IoT Core via MQTT
const transport = new MqttTransport(getEndpointForGame(gameId));

// offline — WebRTC direct
const transport = new WebRtcTransport(peerId);

// same engine, unaware of transport
const engine = new GameEngine(ChessModule, playerId, transport, ...);
```

---

## GameEngine

```typescript
export class GameEngine<TState, TCommand, TEvent> {
  private committedEvents: TEvent[] = [];
  private optimisticEvents: TEvent[] = [];
  private consensus: ConsensusProtocol;

  constructor(
    private module: GameModule<TState, TCommand, TEvent>,
    private playerId: string,
    private transport: GameTransportPort,
    private onStateChange: (state: TState) => void,
    private onError: (error: GameError) => void,
  ) {
    this.consensus = new ConsensusProtocol(transport.peers);
    transport.onMessage(msg => this.handleMessage(msg));
  }

  // UI entry point — only public method
  dispatch(command: TCommand) {
    const cmd = buildCommand(command, this.playerId, this.committedState.seq);

    const result = this.module.handleCommand({ state: this.committedState, command: cmd });
    if (!result.ok) { this.onError(result.error); return; }

    this.applyOptimistic(cmd.id, result.value.events);
    this.transport.publish(`games/${gameId}/commands`, cmd);
  }

  // peer sent command — validate and vote
  private handlePeerCommand(cmd: Command<TCommand>) {
    const result = this.module.handleCommand({ state: this.committedState, command: cmd });
    this.transport.publish(`games/${gameId}/votes`, {
      commandId: cmd.id,
      from: this.playerId,
      vote: result.ok ? 'ACK' : 'REJECT',
    });
  }

  // vote received — check quorum
  private handleVote(vote: Vote) {
    const result = this.consensus.record(vote);
    if (result.status === 'COMMITTED') this.publishEvent(vote.commandId);
    if (result.status === 'REJECTED') { this.rollbackOptimistic(vote.commandId); this.flagBadActor(result); }
  }

  // committed event — apply to state
  private handleCommittedEvent(payload: { commandId: string; events: TEvent[] }) {
    this.optimisticEvents = this.optimisticEvents.filter(e => e.commandId !== payload.commandId);
    payload.events.forEach(event => {
      this.committedEvents.push(event);
    });
    this.emitState();
  }

  // UI always sees optimistic state on top of committed
  private get committedState() { return reduce(this.module, this.committedEvents); }
  private get optimisticState() { return reduce(this.module, [...this.committedEvents, ...this.optimisticEvents]); }
  private emitState() { this.onStateChange(this.optimisticState); }
}
```

---

## ConsensusProtocol

```typescript
export class ConsensusProtocol {
  private votes = new Map<string, Map<string, 'ACK' | 'REJECT'>>();

  constructor(private peers: string[]) {}

  private get quorum() {
    return Math.floor(this.peers.length / 2) + 1;
  }

  record(vote: Vote): ConsensusResult {
    if (!this.votes.has(vote.commandId)) this.votes.set(vote.commandId, new Map());
    this.votes.get(vote.commandId)!.set(vote.from, vote.vote);
    return this.evaluate(vote.commandId);
  }

  private evaluate(commandId: string): ConsensusResult {
    const votes = this.votes.get(commandId)!;
    const acks = [...votes.values()].filter(v => v === 'ACK').length;
    const rejects = [...votes.values()].filter(v => v === 'REJECT').length;
    if (acks >= this.quorum) return { status: 'COMMITTED' };
    if (rejects >= this.quorum) return { status: 'REJECTED' };
    return { status: 'PENDING' };
  }
}
```

---

## Ports and Adapters

```typescript
// transport port — engine never knows what's underneath
export interface GameTransportPort {
  send(message: Message): Promise<void>;
  onMessage(handler: (message: Message) => void): () => void;
  onDisconnect(handler: () => void): () => void;
  peers: string[];
}

// pub/sub port — broker never knows game logic
export interface PubSubPort {
  publish(topic: string, payload: object): Promise<void>;
  subscribe(topic: string, handler: (payload: object) => Promise<void>): () => void;
}
```

### Adapters matrix

```
Environment         GameTransport         PubSub
──────────────────────────────────────────────────────
Online              MqttTransport         MqttRelayAdapter (IoT Core)
Offline P2P         WebRtcTransport       WebRtcAdapter
Local dev           MqttTransport         MqttRelayAdapter (Mosquitto)
Server (optional)   MqttTransport         MqttRelayAdapter (IoT Core)
```

Same `MqttRelayAdapter` in all networked environments — env vars swap the broker.

---

## React Hook

```typescript
export function useGame(gameId: string, playerId: string) {
  const [state, setState] = useState<ChessState>(ChessModule.initialState());
  const [error, setError] = useState<GameError | null>(null);
  const engineRef = useRef<GameEngine<...>>();

  useEffect(() => {
    const transport = new WsTransport(getBoxForGame(gameId));
    engineRef.current = new GameEngine(ChessModule, playerId, transport, setState, setError);

    // rehydrate from event log on mount/reconnect
    gameApi.getEvents(gameId).then(events => {
      events.forEach(e => engineRef.current!.applyCommitted(e));
    });

    return () => transport.disconnect();
  }, [gameId]);

  return {
    state,
    error,
    dispatch: (cmd: ChessCommand) => engineRef.current?.dispatch(cmd),
  };
}
```

### Component usage

```typescript
function ChessGame({ gameId, playerId }: Props) {
  const { state, error, dispatch } = useGame(gameId, playerId);

  return (
    <View>
      <ChessBoard
        state={state}
        onMove={(from, to) => dispatch({ type: 'MOVE_PIECE', from, to })}
      />
      {error && <ErrorBanner error={error} />}
    </View>
  );
}
```

---

## Server — Optional, Never Authority

The server is always a peer, never a ruler. It participates in consensus using identical `GameModule` code:

```typescript
// server subscribes to commands, validates, votes
this.pubsub.subscribe('games/+/commands', async (cmd) => {
  const state = await this.getState(cmd.gameId);
  const result = GameModule.handleCommand({ state, command: cmd });

  await this.pubsub.publish(`games/${cmd.gameId}/votes`, {
    commandId: cmd.id,
    from: 'server',
    vote: result.ok ? 'ACK' : 'REJECT',
  });

  // persist if valid — for reconnect recovery only
  if (result.ok) await this.appendEvent(cmd.gameId, cmd);
});
```

Server roles by game mode:

```
Casual      → not involved
Competitive → votes as fourth participant, persists event log
Ranked      → persists event log, flags suspicious patterns async
```

### Reconnect recovery

Because state is event sourced, reconnect is trivial:

```typescript
ws.onclose = async () => {
  const missed = await gameApi.getEvents(gameId, { fromSeq: lastKnownSeq });
  setState(reduce(module, missed));
  reconnect();
};
```

---

## Infrastructure Summary

```
MQTT relay              AWS IoT Core, 3-5 regions globally
                        Stateless dumb MQTT broker
                        $0.042/million connection-minutes
                        $0.08/million messages
                        Consistent hashing assigns games to regions

RPC server              App Runner
                        Game creation, referee selection, endpoint assignment
                        Stateless HTTP

SSE sync server         App Runner
                        PatchDB invalidation signals
                        Stateless, one SSE connection per client

Aurora Postgres         Event log, game registry, reputation
                        Source of truth for reconnects only

Local dev               docker-compose
                        Mosquitto replaces IoT Core (same MQTT protocol)
                        postgres:16 replaces Aurora
                        Same Docker image as prod — perfect parity
```

---

## Dependencies

```typescript
import { ulid } from 'ulid';                    // command IDs
import murmurhash from 'murmurhash';            // box hashing
import ConsistentHashing from 'consistent-hashing'; // stable box assignment
import { Result, ok, err } from 'neverthrow';  // Result type
```

Everything else — `GameModule`, `GameEngine`, `ConsensusProtocol`, `GameTransport` — is your code. ~500 lines total. No framework needed.

---

## Key Invariants

1. Events come only from `handleCommand` — never from outside
2. State comes only from `handleEvent` — never mutated directly
3. UI dispatches commands — never events
4. Servers are peers — never authorities
5. Boxes are relays — never stateful
6. `GameModule` is pure — no side effects, no network, no DB
7. Same `GameModule` code runs on all participants — client, referee, server
