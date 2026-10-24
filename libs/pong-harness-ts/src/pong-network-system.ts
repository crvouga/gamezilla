import {
  simulationRoomCourt,
  simulationRoomFixture,
} from '@libs/game-session-harness-ts/simulation-room-fixture';
import { connectSimulationRoomFixture } from '@libs/game-session-harness-ts/simulation-room-presentation';
import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import {
  type SimulationSnapshotPayload,
  SimulationStateChanged,
  SubmitSimulationInput,
} from '@libs/game-session-shared-ts/simulation-messages';
import {
  pongGameShared,
  pongPositionCodec,
} from '@libs/pong-shared-ts/pong-game';
import type { PongState } from '@libs/pong-shared-ts/pong-state';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import { ROOM_VIRTUAL_RUNTIME } from '@pkgs/room-root-harness-ts/boot';
import { createRoomHarnessRuntime } from '@pkgs/room-root-harness-ts/create-room-harness';
import type { RoomFaultProfile } from '@pkgs/room-root-harness-ts/network';

function rallyPosition(seed: string): string {
  const game = pongGameShared.registration.simulation!;
  const engine = new FixedStepSimulation(game.initialize(seed), game.step, {
    ...game.timing,
    seed,
  });
  for (let tick = 0; tick < game.timing.tickRate * 3.75; tick++)
    engine.advanceTicks(1);
  return game.codec.encode(engine.snapshot().state);
}

async function createNetworkPong(session: Session) {
  const id = session.ports.createId();
  const kit = await createRoomHarnessRuntime({
    session,
    module: simulationRoomFixture(
      {
        game: pongGameShared,
        id,
        viewers: ['carol'],
        position: rallyPosition(id),
      },
      session.ports.clock,
      session.ports.random
    ),
    topic: 'space:pong-network',
  });
  (session as { waitForIdle: () => Promise<void> }).waitForIdle = kit.drain;
  const views = new Map<
    string,
    { position: string | null; paused: boolean; stale: boolean }
  >();
  const history = new Map<string, PongState[]>();
  const errors: unknown[] = [];
  const signals = new Map<string, SimulationSnapshotPayload>();
  const connections = new Map<
    string,
    ReturnType<typeof connectSimulationRoomFixture>
  >();
  for (const owner of ['alice', 'bob', 'carol']) {
    const client = await kit.addClient({ id: owner });
    await kit.drain();
    session.onDispose(
      client.room()!.subscribeSignal((message) => {
        if (SimulationStateChanged.is(message))
          signals.set(owner, message.payload);
      })
    );
    const connection = connectSimulationRoomFixture(pongGameShared, {
      owner,
      room: client.room()!,
      clock: session.ports.clock,
      timers: session.ports.timers,
      createId: session.ports.createId,
      changed: (view) => {
        const previous = views.get(owner);
        views.set(owner, view);
        // Repeated paints retain the same scores; inspect each position transition once.
        if (previous?.position === view.position) return;
        const state =
          view.position === null
            ? null
            : pongPositionCodec.decode(view.position);
        if (view.position !== null && state === null)
          errors.push(
            new Error('The Pong presentation produced an invalid court')
          );
        if (state !== null) {
          const states = history.get(owner) ?? [];
          states.push(state);
          history.set(owner, states);
        }
      },
      failed: (error) => errors.push(error),
    });
    connections.set(owner, connection);
    session.onDispose(connection.dispose);
  }
  await kit.runFor(20);
  return {
    session,
    kit,
    views,
    history,
    errors,
    signals,
    connections,
    interruption: null as null | {
      id: string;
      before: string | null;
      offline: string | null;
      paused: boolean[];
    },
  };
}
export type PongNetwork = Awaited<ReturnType<typeof createNetworkPong>>;

function guidePlayers(s: PongNetwork): void {
  s.connections
    .get('alice')!
    .replica.control('white', { kind: 'target', target: 0.3 });
  s.connections
    .get('bob')!
    .replica.control('black', { kind: 'target', target: 0.7 });
}

export const impairPongDelivery = defineAction({
  name: 'impairPongDelivery',
  act: async (
    s: PongNetwork,
    faults: RoomFaultProfile,
    holdViewer: boolean
  ) => {
    const effects = ['alice', 'bob', 'carol'].map((id) =>
      s.kit.net(id).set(faults)
    );
    const held = holdViewer
      ? s.kit.net('carol').set({ toClient: 'hold' })
      : null;
    try {
      guidePlayers(s);
      for (let frame = 0; frame < 12; frame++) await s.kit.scheduler.runFor(25);
    } finally {
      held?.restore();
      for (const effect of effects) effect.restore();
    }
    // Reliable room metadata is recovered through the normal reconnect/welcome path.
    await s.kit.recoverAll();
  },
});

export const interruptPongConnection = defineAction({
  name: 'interruptPongConnection',
  act: async (s: PongNetwork, id: 'alice' | 'bob' | 'carol') => {
    const before = s.views.get(id)!.position;
    await s.kit.node(id).disconnect();
    await s.kit.runFor(80);
    s.interruption = {
      id,
      before,
      offline: s.views.get(id)!.position,
      paused: ['alice', 'bob'].map((who) => s.views.get(who)!.paused),
    };
    await s.kit.node(id).reconnect();
    await s.kit.runFor(20);
  },
});

export const challengePongInput = defineAction({
  name: 'challengePongInput',
  act: async (s: PongNetwork) => {
    const court = simulationRoomCourt(await s.kit.server.readCommittedState());
    if (court === null) throw new Error('No live Pong authority');
    const epoch = `${court.execution.epoch}:${court.execution.inputGeneration}`;
    s.kit.clients
      .get('carol')!
      .room()!
      .sendSignal(
        SubmitSimulationInput({
          version: 1,
          epoch,
          playerId: 'white',
          sequence: 9000,
          tick: court.execution.tick + 3,
          value: { kind: 'target', target: 1 },
        })
      );
    s.kit.clients
      .get('alice')!
      .room()!
      .sendSignal(
        SubmitSimulationInput({
          version: 1,
          epoch,
          playerId: 'white',
          sequence: 9000,
          tick: 1,
          value: { kind: 'target', target: 1 },
        })
      );
    await s.kit.drain();
  },
});

export const settlePongDelivery = defineAction({
  name: 'settlePongDelivery',
  act: async (s: PongNetwork) => {
    for (let frame = 0; frame < 20; frame++) {
      guidePlayers(s);
      await s.kit.runFor(20);
    }
    for (const connection of s.connections.values())
      connection.replica.release();
    await s.kit.drain();
    await s.kit.server.setAvailability(false);
    await s.kit.runFor(20);
  },
});

export const pongNetworkSystem = defineSystem({
  name: 'pong-adverse-delivery',
  runtimes: [ROOM_VIRTUAL_RUNTIME],
  create: createNetworkPong,
  actions: [
    impairPongDelivery,
    interruptPongConnection,
    challengePongInput,
    settlePongDelivery,
  ],
});

export async function readPongNetwork(s: PongNetwork) {
  const authority = simulationRoomCourt(
    await s.kit.server.readCommittedState()
  );
  return {
    progress:
      authority === null
        ? null
        : { phase: authority.execution.phase, tick: authority.execution.tick },
    peers: [...s.views].map(([id, view]) => {
      const execution = simulationRoomCourt(
        s.kit.clients.get(id)!.snapshot()
      )?.execution;
      const signal = s.signals.get(id);
      return {
        id,
        paused: view.paused,
        stale: view.stale,
        generation: execution?.inputGeneration,
        signal:
          signal === undefined
            ? null
            : {
                paused: signal.paused,
                tick: signal.tick,
                revision: signal.revision,
                matches:
                  execution !== undefined &&
                  signal.epoch ===
                    `${execution.epoch}:${execution.inputGeneration}`,
              },
      };
    }),
    authority,
    views: [...s.views.values()],
    history: [...s.history.values()],
    errors: s.errors,
    interruption: s.interruption,
    spectatorRejection: s.kit.clients.get('carol')!.lastRejection(),
  };
}
