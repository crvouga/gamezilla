import { connectCustomSimulation } from '@libs/game-session-client-ts/custom-simulation-session';
import { simulationRoomFixture } from '@libs/game-session-harness-ts/simulation-room-fixture';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import { RequestSimulationSnapshot } from '@libs/game-session-shared-ts/simulation-messages';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import { ROOM_VIRTUAL_RUNTIME } from '@pkgs/room-root-harness-ts/boot';
import { createRoomHarnessRuntime } from '@pkgs/room-root-harness-ts/create-room-harness';
import type { RoomFaultProfile } from '@pkgs/room-root-harness-ts/network';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { decode, networkRace } from './network-race';

async function createNetworkSurface(session: Session) {
  const kit = await createRoomHarnessRuntime({
    session,
    module: simulationRoomFixture(
      { game: networkRace, id: 'race-1', viewers: ['eve'] },
      session.ports.clock,
      session.ports.random
    ),
    topic: 'space:race',
  });
  (session as { waitForIdle: () => Promise<void> }).waitForIdle = kit.drain;
  const positions = new Map<string, string | null>();
  const distances = new Map<string, number[]>();
  const errors: unknown[] = [];
  const connections = new Map<
    string,
    ReturnType<typeof connectCustomSimulation>
  >();
  const rules = createTurnGames([networkRace.registration]);
  for (const identity of ['alice', 'bob', 'eve']) {
    const client = await kit.addClient({ id: identity });
    await kit.drain();
    const room = client.room()!;
    const game = CustomGamesAttr.from(room.getSnapshot()).current!;
    const connection = connectCustomSimulation({
      room,
      game,
      owner: identity,
      rules,
      clock: session.ports.clock,
      timers: session.ports.timers,
      createId: session.ports.createId,
      changed: (next) => {
        positions.set(identity, next.position);
        const state = next.position === null ? null : decode(next.position);
        if (state === null) return;
        const history = distances.get(identity) ?? [];
        history.push(state.distance);
        distances.set(identity, history);
      },
      failed: (error) => errors.push(error),
    });
    connections.set(identity, connection);
    session.onDispose(connection.dispose);
  }
  await kit.drain();
  return { session, kit, positions, distances, errors, connections };
}
export type NetworkSurface = Awaited<ReturnType<typeof createNetworkSurface>>;
export type NetworkWindow = {
  readonly faults: RoomFaultProfile;
  readonly hold: boolean;
};

export const impairNetwork = defineAction({
  name: 'impairNetwork',
  act: async (s: NetworkSurface, window: NetworkWindow) => {
    const effects = ['alice', 'bob', 'eve'].map((id) =>
      s.kit.net(id).set(window.faults)
    );
    const hold = window.hold
      ? s.kit.net('eve').set({ toClient: 'hold' })
      : null;
    try {
      s.connections.get('alice')!.replica.control('white', 4);
      s.connections.get('bob')!.replica.control('black', 7);
      for (let frame = 0; frame < 12; frame++) {
        s.connections.get('alice')!.replica.pump();
        s.connections.get('bob')!.replica.pump();
        await s.kit.scheduler.runFor(40);
      }
    } finally {
      hold?.restore();
      for (const effect of effects) effect.restore();
    }
    await s.kit.drain();
  },
});

export const settleNetwork = defineAction({
  name: 'settleNetwork',
  act: async (s: NetworkSurface) => {
    await s.kit.runFor(200);
    await s.kit.server.setAvailability(false);
    await s.kit.drain();
    for (const client of s.kit.clients.values())
      client.room()!.sendSignal(RequestSimulationSnapshot({ version: 1 }));
    await s.kit.runFor(20);
  },
});

export const liveNetworkSystem = defineSystem({
  name: 'live-counting-race-network',
  runtimes: [ROOM_VIRTUAL_RUNTIME],
  create: createNetworkSurface,
  actions: [impairNetwork, settleNetwork],
});
