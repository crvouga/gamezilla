import { createSimAdapters } from '@pkgs/uuid';
import { openWorld } from '../../sim/world';
import type { RoomSimClientHandle, World } from '../../sim/world-api';
import type {
  RoomCommand,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '../../types';

import { assertHashCanonical } from './assert-hash-canonical';
import { assertTotality } from './assert-totality';
import type { ModuleConformanceArgs } from './types';

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

async function assertSettledDomain<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  world: World<S, C, E>,
  client: RoomSimClientHandle<S, C, E>,
  args: ModuleConformanceArgs<S, C, E>
): Promise<void> {
  assertDomainValid('server fold', await world.serverSnapshot(), args);
  assertDomainValid('client fold', client.snapshot(), args);
  if ((await world.serverHash()) !== client.hash()) {
    throw new Error('E1: client hash diverged from serverHash after settle');
  }
}

/**
 * Parameterized module-contract suite (M1–M8 smoke via real engine + pure checks).
 */
export async function runModuleConformance<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: ModuleConformanceArgs<S, C, E>): Promise<void> {
  const identities = args.identities ?? ['alice', 'bob'];
  const steps = args.fuzzSteps ?? 24;

  // M8: pure seed-stable handle/reduce/hash.
  const hashA = purePlay(args, identities[0]!, 8);
  const hashB = purePlay(args, identities[0]!, 8);
  if (hashA !== hashB) {
    throw new Error(`M8 seed drift: ${hashA} !== ${hashB}`);
  }

  // M2 + M3 on reachable corpus from pure play.
  const corpus = collectStates(args, identities[0]!, 12);
  assertHashCanonical(args.module, corpus.states);
  assertTotality({
    module: args.module,
    states: corpus.states,
    commands: corpus.commands,
    identities,
  });

  // Engine fuzz: converge under mild faults (E1 + module).
  await using world = await openWorld({
    seed: args.seed,
    module: args.module,
    mildFaults: args.mildFaults ?? true,
  });
  const clients = [];
  for (const id of identities.slice(0, 3)) {
    clients.push(await world.addClient({ id, identity: id }));
  }
  await world.assertConverged();

  const rng = world.rng.fork('kit-fuzz');
  for (let step = 0; step < steps; step += 1) {
    const client = clients[rng.int(clients.length)]!;
    const payload = args.generateCommand({
      rng,
      state: client.snapshot(),
      identity: client.identity,
      now: world.clock.now(),
      step,
    });
    if (payload === null) continue;
    client.dispatch(payload);
    if (step % 5 === 4) {
      using _h = world.net(client.id).set('hold');
      await world.drain();
    } else {
      await world.drain();
    }
  }
  for (const c of clients) {
    await c.disconnect();
    await c.connect();
  }
  await world.assertConverged();
  await assertSettledDomain(world, clients[0]!, args);
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
  const adapters = createSimAdapters({ seed: args.seed, startMs: 1_000 });
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
): { states: S[]; commands: RoomCommand<C>[] } {
  const adapters = createSimAdapters({ seed: args.seed, startMs: 1_000 });
  let state = args.module.initialState();
  const states: S[] = [state];
  const commands: RoomCommand<C>[] = [];
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
    commands.push(command);
    const result = args.module.handle(state, command, identity);
    if (result.ok) {
      for (const ev of result.events) {
        state = args.module.reduce(state, ev);
      }
      states.push(state);
    }
    adapters.clock.advance(10);
  }
  return { states, commands };
}
