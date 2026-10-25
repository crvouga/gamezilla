import { DEVICE_ID_KEY } from '@libs/auth-shared-ts/auth-storage-keys';
import { hostedSpaceId } from '@libs/game-matchmaking-harness-ts/multiplayer-spaces';
import type { CustomGameChoice } from '@libs/game-session-shared-ts/custom-game-choice';
import {
  ChangeCustomGame,
  CustomGamesChanged,
} from '@libs/game-session-shared-ts/custom-game-commands';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import type { HarnessRoomNode } from '@libs/harness-ts/composition';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { harnessRoomGateway } from '@libs/harness-ts/room-gateway';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { ClientTransport } from '@pkgs/room-root-shared-ts/transport';
import {
  parseServerToClientWire,
  ROOM_WIRE_KIND,
  WIRE_VERSION,
} from '@pkgs/room-root-shared-ts/wire';
import { readCustomGameIdentity } from './custom-game-identity';
import { readCustomGameProbe } from './custom-game-probe';

export type PrivateSetupCheckpoint = {
  readonly topic: string;
  readonly at: number;
  readonly room: NonNullable<ReturnType<HarnessRoomNode['exportTopic']>>;
  readonly gameId: string;
  readonly revision: number;
  readonly creator: string;
  readonly people: readonly {
    readonly actor: string;
    readonly identity: string;
    readonly installId: string;
  }[];
};

/** One real pre-choice room, including its complete presence and activity history. */
export async function privateSetupCheckpoint(
  s: ProductHarness,
  creator: string,
  people: readonly string[]
): Promise<PrivateSetupCheckpoint> {
  await s.session.waitForIdle();
  const spaceId = await hostedSpaceId(s, creator);
  const game = (await readCustomGameProbe(s, creator))?.current;
  if (spaceId === null || game == null)
    throw new Error('A paired setup needs an existing custom game');
  if (game.status !== 'configuring' || game.ready.length !== 0)
    throw new Error('The paired checkpoint must precede every private choice');
  const topic = `space:${spaceId}`;
  const room = s.harness.roomNode.exportTopic(topic);
  if (room === null)
    throw new Error('The paired room has no committed history');
  const identities = [];
  for (const actor of people) {
    const env = await s.harness.client(actor);
    const installId = env.secureStorage.getValue(DEVICE_ID_KEY);
    if (installId === null) throw new Error(`${actor} has no install identity`);
    identities.push({
      actor,
      identity: await readCustomGameIdentity(s, actor),
      installId,
    });
  }
  return {
    topic,
    at: s.harness.clock.now(),
    room: structuredClone(room),
    gameId: game.id,
    revision: game.revision,
    creator,
    people: identities,
  };
}

type Peer = {
  readonly actor: string;
  readonly transport: ClientTransport;
  readonly frames: unknown[];
};

function forkRoom(s: ProductHarness, checkpoint: PrivateSetupCheckpoint) {
  const factory = s.harness.composition.roomNode;
  if (factory === undefined)
    throw new Error('The composition has no room host');
  const { clock, timers } = createHarnessClock({ startMs: checkpoint.at });
  let nextId = 0;
  const createId = () => `paired-connection-${String(nextId++)}`;
  const random = () => 0.5;
  const node: HarnessRoomNode = factory(
    { clock, timers, createId, random, seed: 1n },
    {
      roomGrants: (args) =>
        harnessRoomGateway({
          composition: s.harness.composition,
          serverSql: s.harness.serverSql,
          clock,
          rooms: node.services,
        }).roomGrants(args),
    }
  );
  return { node, clock, timers, createId, random };
}

async function openPeers(
  fork: ReturnType<typeof forkRoom>,
  checkpoint: PrivateSetupCheckpoint
): Promise<Peer[]> {
  const peers: Peer[] = [];
  for (const person of checkpoint.people) {
    const transport = fork.node.createTransport({
      topic: checkpoint.topic,
      module: 'space',
      identity: person.identity,
      installId: person.installId,
      clientId: `paired-${person.actor}`,
      apiUrl: '',
      clock: fork.clock,
      timers: fork.timers,
      random: fork.random,
      getSessionToken: () => null,
    });
    const frames: unknown[] = [];
    transport.subscribe((frame) => frames.push(structuredClone(frame)));
    peers.push({ actor: person.actor, transport, frames });
    await transport.connect();
  }
  await fork.node.services.read(checkpoint.topic);
  return peers;
}

async function awaitFrame(
  node: HarnessRoomNode,
  topic: string,
  frames: readonly unknown[],
  accepted: (frame: unknown) => boolean
): Promise<void> {
  for (let turn = 0; turn < 1_000; turn += 1) {
    if (frames.some(accepted)) return;
    await node.services.read(topic);
  }
  throw new Error('The paired room did not acknowledge its operation');
}

async function choose(
  node: HarnessRoomNode,
  checkpoint: PrivateSetupCheckpoint,
  peer: Peer,
  command: { readonly id: string; readonly choice: CustomGameChoice }
): Promise<void> {
  const { id, choice } = command;
  peer.transport.sendJson({
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.command,
    id,
    ts: checkpoint.at,
    payload: ChangeCustomGame(choice),
  });
  await awaitFrame(node, checkpoint.topic, peer.frames, (raw) => {
    const frame = parseServerToClientWire(raw);
    if (frame?.kind === ROOM_WIRE_KIND.rejected && frame.commandId === id)
      throw new Error(
        `The paired ${id} was refused: ${JSON.stringify(frame.error)}`
      );
    return frame?.kind === ROOM_WIRE_KIND.committed && frame.commandId === id;
  });
  const receipt = peer.frames.flatMap((raw) => {
    const frame = parseServerToClientWire(raw);
    return frame?.kind === ROOM_WIRE_KIND.committed && frame.commandId === id
      ? frame.entries.map((entry) => entry.event).filter(CustomGamesChanged.is)
      : [];
  })[0];
  if (receipt === undefined || receipt.payload.reason !== '')
    throw new Error(`The paired ${id} did not make its requested game choice`);
}

async function observerWire(
  node: HarnessRoomNode,
  topic: string,
  peers: readonly Peer[],
  observers: readonly string[]
): Promise<string> {
  const observed = [];
  for (const actor of observers) {
    const peer = peers.find((person) => person.actor === actor);
    if (peer === undefined) throw new Error(`No paired observer ${actor}`);
    peer.transport.sendJson({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.sync,
      fromSeq: 0,
    });
    await awaitFrame(
      node,
      topic,
      peer.frames,
      (frame) => parseServerToClientWire(frame)?.kind === ROOM_WIRE_KIND.welcome
    );
    observed.push({ actor, frames: structuredClone(peer.frames) });
  }
  return JSON.stringify(observed);
}

/** Execute a private branch against the real composed room and gateway, from the same prefix. */
export async function privateSetupWireFromCheckpoint(
  s: ProductHarness,
  checkpoint: PrivateSetupCheckpoint,
  input: {
    readonly setups: Readonly<Record<string, string>>;
    readonly observers: readonly string[];
  }
): Promise<string> {
  const fork = forkRoom(s, checkpoint);
  const peers: Peer[] = [];
  try {
    await fork.node.replaceTopic(checkpoint.topic, {
      liveCheckpoint: structuredClone(checkpoint.room.liveCheckpoint),
      entries: structuredClone(checkpoint.room.entries),
      dedup: structuredClone(checkpoint.room.dedup ?? {}),
    });
    peers.push(...(await openPeers(fork, checkpoint)));
    const reference = {
      gameId: checkpoint.gameId,
      revision: checkpoint.revision,
    };
    for (const [actor, setup] of Object.entries(input.setups)) {
      const peer = peers.find((person) => person.actor === actor);
      if (peer === undefined)
        throw new Error(`No paired connection for ${actor}`);
      await choose(fork.node, checkpoint, peer, {
        id: `ready:${actor}`,
        choice: { ...reference, operation: 'ready', setup },
      });
    }
    const creator = peers.find((peer) => peer.actor === checkpoint.creator);
    if (creator === undefined) throw new Error('No paired creator connection');
    await choose(fork.node, checkpoint, creator, {
      id: 'start',
      choice: { ...reference, operation: 'start' },
    });
    const active = CustomGamesAttr.from(
      await fork.node.services.read(checkpoint.topic)
    ).current;
    if (active?.status !== 'active')
      throw new Error('The paired private choices did not start the game');
    return await observerWire(
      fork.node,
      checkpoint.topic,
      peers,
      input.observers
    );
  } finally {
    for (const peer of peers) peer.transport.destroy();
    await fork.node.services.read(checkpoint.topic);
    fork.node.dispose();
  }
}
