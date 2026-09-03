import { defineSystem } from '@pkgs/dst';
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

const { defineAction, defineProperty } = schema;

export function clientIds(s: SchemaSurface): string[] {
  return s.clients.map((c) => c.id);
}

export function peerIdList(s: SchemaSurface): string[] {
  return [...peerIds(s)];
}

export function serverVersion(s: SchemaSurface): SchemaVersion {
  return s.server.version;
}

export function clientVersions(s: SchemaSurface): SchemaVersion[] {
  return s.clients.map((c) => c.version);
}

export function serverPlanKinds(s: SchemaSurface): string[] {
  return [...s.server.planKinds];
}

export async function alignmentViolations(s: SchemaSurface): Promise<string[]> {
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
}

export const advance = defineAction({
  name: 'advance',
  enabled: (s) => peerIdList(s).length > 0,
  weight: 3,
  args: (s) =>
    gen(
      fc.record({
        target: fc.constantFrom(...peerIdList(s)),
        to: fc.integer({
          min: 0,
          max: MAX_SCHEMA_VERSION,
        }),
      })
    ),
  act: async (s, args: { readonly target: string; readonly to: number }) => {
    await applyAdvance(s, args.target, args.to as SchemaVersion);
  },
});

export const forbidden = defineAction({
  name: 'forbidden',
  act: async (s) => {
    await applyForbidden(s);
  },
});

export const SCHEMA_ACTIONS = [advance, forbidden];

export const aligned = defineProperty({
  name: 'aligned',
  check: async (s) => {
    const v = await alignmentViolations(s);
    if (v.length > 0) throw new Error(v[0]!);
  },
});

export const SCHEMA_PROPERTIES = [aligned];

export const arbSchemaKnobs = (): fc.Arbitrary<SchemaKnobs> =>
  fc.record({ clients: fc.integer({ min: 1, max: 3 }) });

export { SCHEMA_SERVER_ID };
