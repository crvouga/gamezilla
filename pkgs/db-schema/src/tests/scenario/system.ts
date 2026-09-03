import { defineSystem, draw } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import { applyAdvance, applyForbidden } from './dispatch';
import { assertServerLiveColumns } from './invariants';
import { startClient, startServer } from './nodes';
import { planKindHash, SCHEMA_SERVER_ID } from './peers';
import { MAX_SCHEMA_VERSION, type SchemaVersion } from './schemas';
import type { SchemaSurface } from './types';
import { peerIds } from './types';

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

const PLAN_HASH_HEX_LENGTH = 64;

export type SchemaKnobs = {
  readonly clients: number;
};

export const schema = defineSystem({
  name: 'db-schema.reconcile',
  async generate(session, knobs: SchemaKnobs) {
    const server = await startServer(session.fork('server'));
    const clients = await Promise.all(
      range(knobs.clients).map((i) =>
        startClient(session.fork(`client:${i}`), i)
      )
    );
    return { session, server, clients } satisfies SchemaSurface;
  },
});

const { defineObservation, defineAction, defineProperty } = schema;

export const clientIds = defineObservation({
  name: 'clientIds',
  observe: (s) => s.clients.map((c) => c.id),
});

export const peerIdList = defineObservation({
  name: 'peerIdList',
  observe: (s) => [...peerIds(s)],
});

export const serverVersion = defineObservation({
  name: 'serverVersion',
  observe: (s) => s.server.version,
});

export const clientVersions = defineObservation({
  name: 'clientVersions',
  observe: (s) => s.clients.map((c) => c.version),
});

export const serverPlanKinds = defineObservation({
  name: 'serverPlanKinds',
  observe: (s) => [...s.server.planKinds],
});

export const alignmentViolations = defineObservation({
  name: 'alignmentViolations',
  observe: async (s) => {
    const out: string[] = [];
    try {
      await assertServerLiveColumns(s.server);
      for (const client of s.clients) {
        if (client.version > s.server.version) {
          out.push(
            `client ${client.id}@v${client.version} ahead of server@v${s.server.version}`
          );
        }
      }
      if (planKindHash(s.server).length !== PLAN_HASH_HEX_LENGTH) {
        out.push('server plan hash is not a sha256 hex digest');
      }
    } catch (e) {
      out.push(e instanceof Error ? e.message : String(e));
    }
    return out;
  },
});

export type AdvanceArgs = {
  readonly target: string;
  readonly to: SchemaVersion;
};

export const advance = defineAction({
  name: 'advance',
  generate(args: AdvanceArgs) {
    return (s) => applyAdvance(s, args.target, args.to);
  },
});

export const randomAdvance = defineAction({
  name: 'randomAdvance',
  *generate() {
    const ids = yield* peerIdList;
    if (ids.length === 0) return;
    const { target, to } = yield* draw(
      gen(
        fc.record({
          target: fc.constantFrom(...(ids as string[])),
          to: fc.integer({
            min: 0,
            max: MAX_SCHEMA_VERSION,
          }) as fc.Arbitrary<SchemaVersion>,
        })
      )
    );
    yield {
      weight: 3,
      act: (s: SchemaSurface) => applyAdvance(s, target, to),
    };
  },
});

export const forbidden = defineAction({
  name: 'forbidden',
  generate() {
    return (s) => applyForbidden(s);
  },
});

export const SCHEMA_ACTIONS = [randomAdvance, forbidden];

export const aligned = defineProperty({
  name: 'aligned',
  *watch() {
    const v = yield* alignmentViolations;
    if (v.length > 0) throw new Error(v[0]!);
  },
});

export const SCHEMA_PROPERTIES = [aligned];

export const arbSchemaKnobs = (): fc.Arbitrary<SchemaKnobs> =>
  fc.record({ clients: fc.integer({ min: 1, max: 3 }) });

export { SCHEMA_SERVER_ID };
