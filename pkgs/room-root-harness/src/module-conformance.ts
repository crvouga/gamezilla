import { defineSystem } from '@pkgs/harness-root-shared/define-system';
import type {
  RoomCommand,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room-root-shared/types';
import { createHarnessAdapters } from '@pkgs/uuid-shared/harness-adapters';
import { createSeededRng } from '@pkgs/uuid-shared/seeded-rng';
import type { RoomArgs } from './args';
import { ROOM_ARGS, ROOM_DRAW } from './args';
import { assertHashCanonical } from './assert-hash-canonical';
import { assertTotality } from './assert-totality';
import { bootRoomHarness, ROOM_VIRTUAL_RUNTIME } from './boot';
import { expectInSync } from './expect-in-sync';
import type { RoomHarness } from './harness';
import type { ModuleConformanceArgs } from './module-conformance-types';
import {
  clientHash,
  clientState,
  clock,
  seed as seedOf,
  serverHash,
  serverState,
} from './observations';
import {
  addClient,
  connect,
  disconnect,
  dispatch,
  pauseNetwork,
  resumeNetwork,
} from './room-actions';
import type { RoomApp } from './scenario-app';

function assertDomainValid<S extends RoomState>(
  label: string,
  state: S,
  args: ModuleConformanceArgs<S, RoomCommandPayload, RoomEvent>
): void {
  if (!args.isValidState(state)) {
    throw new Error(`M4: ${label} failed isValidState`);
  }
  if (args.isTerminal?.(state) === true && args.outcomeId) {
    const oid = args.outcomeId(state);
    if (oid === null) {
      throw new Error(`M6: ${label} terminal missing outcomeId`);
    }
  }
}

function conformanceApp<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(module: ModuleConformanceArgs<S, C, E>['module']): RoomApp {
  return {
    module: module as RoomApp['module'],
    domainOpArbs: () => [],
    toPayload: () => {
      throw new Error('conformance: domain ops unused');
    },
  };
}

/**
 * Parameterized module-contract suite (M1–M8 checks via real engine + pure checks).
 */
export async function runModuleConformance<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: ModuleConformanceArgs<S, C, E>): Promise<void> {
  const identities = args.identities ?? ['alice', 'bob'];
  const steps = args.fuzzSteps ?? 24;

  const hashA = purePlay(args, identities[0]!, 8);
  const hashB = purePlay(args, identities[0]!, 8);
  if (hashA !== hashB) {
    throw new Error(`M8 seed drift: ${hashA} !== ${hashB}`);
  }

  const corpus = collectStates(args, identities[0]!, 12);
  assertHashCanonical(args.module, corpus.states);
  assertTotality({
    module: args.module,
    states: corpus.states,
    actions: corpus.actions,
    identities,
  });

  await engineFuzz(args, identities, steps);
}

async function engineFuzz<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  args: ModuleConformanceArgs<S, C, E>,
  identities: readonly string[],
  steps: number
): Promise<void> {
  const app = conformanceApp(args.module);
  const system = defineSystem<RoomHarness, RoomArgs>({
    name: 'room.conformance',
    args: ROOM_ARGS,
    sample: ROOM_DRAW,
    create: (session, systemArgs) => bootRoomHarness(session, app, systemArgs),
    runtimes: [ROOM_VIRTUAL_RUNTIME],
  });
  await using s = await system.run({
    seed: args.seed,
    args: { clientCount: 0, mildFaults: args.mildFaults ?? true },
  });
  const ids = identities.slice(0, 3);
  for (const id of ids) {
    await s.apply(addClient, { id, identity: id });
  }
  await expectInSync(s);

  const rng = createSeededRng(await s.read(seedOf)).fork('kit-fuzz');
  for (let step = 0; step < steps; step += 1) {
    const id = ids[rng.int(ids.length)]!;
    const states = (await s.read(clientState)) as Record<string, S>;
    const payload = args.generateCommand({
      rng,
      state: states[id] as S,
      identity: id,
      now: await s.read(clock),
      step,
    });
    if (payload === null) continue;
    await s.apply(dispatch, { clientId: id, payload });
    if (step % 5 === 4) {
      await s.apply(pauseNetwork, id);
      await s.advanceTime(0);
      await s.apply(resumeNetwork, id);
    } else {
      await s.advanceTime(0);
    }
  }
  for (const id of ids) {
    await s.apply(disconnect, id);
    await s.apply(connect, id);
  }
  await expectInSync(s);
  const server = (await s.read(serverState)) as S;
  const clients = (await s.read(clientState)) as Record<string, S>;
  assertDomainValid('server fold', server, args);
  assertDomainValid('client fold', clients[ids[0]!] as S, args);
  const hashes = (await s.read(clientHash)) as Record<string, string>;
  if ((await s.read(serverHash)) !== hashes[ids[0]!]) {
    throw new Error('E1: client hash diverged from serverHash after settle');
  }
}

function purePlay<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  args: ModuleConformanceArgs<S, C, E>,
  identity: string,
  steps: number
): string {
  const adapters = createHarnessAdapters({ seed: args.seed, startMs: 1_000 });
  let state = args.module.initialState();
  const rng = adapters.rng.fork('pure');
  for (let step = 0; step < steps; step += 1) {
    const payload = args.generateCommand({
      rng,
      state,
      identity,
      now: adapters.clock.now(),
      step,
    });
    if (payload === null) continue;
    const command: RoomCommand<C> = {
      id: adapters.createId(),
      ts: adapters.clock.now(),
      payload,
    };
    const result = args.module.handle(state, command, identity);
    if (result.ok) {
      for (const ev of result.events) {
        state = args.module.reduce(state, ev);
      }
    }
    adapters.clock.advance(10);
  }
  return args.module.hash(state);
}

function collectStates<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  args: ModuleConformanceArgs<S, C, E>,
  identity: string,
  steps: number
): { states: S[]; actions: RoomCommand<C>[] } {
  const adapters = createHarnessAdapters({ seed: args.seed, startMs: 1_000 });
  let state = args.module.initialState();
  const states: S[] = [state];
  const actions: RoomCommand<C>[] = [];
  const rng = adapters.rng.fork('corpus');
  for (let step = 0; step < steps; step += 1) {
    const payload = args.generateCommand({
      rng,
      state,
      identity,
      now: adapters.clock.now(),
      step,
    });
    if (payload === null) continue;
    const command: RoomCommand<C> = {
      id: adapters.createId(),
      ts: adapters.clock.now(),
      payload,
    };
    actions.push(command);
    const result = args.module.handle(state, command, identity);
    if (result.ok) {
      for (const ev of result.events) {
        state = args.module.reduce(state, ev);
      }
      states.push(state);
    }
    adapters.clock.advance(10);
  }
  return { states, actions };
}
