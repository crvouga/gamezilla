import { type ActionGeneratorContext, actions } from '@pkgs/dst';
import fc from 'fast-check';
import { applyAdvance, applyForbidden } from './dispatch';
import { SCHEMA_SERVER_ID } from './peers';
import { MAX_SCHEMA_VERSION, type SchemaVersion } from './schemas';
import type { SchemaSurface } from './types';

export type AdvanceAction = {
  readonly kind: 'advance';
  /** Peer node id — the server id or a client id. */
  readonly target: string;
  readonly to: SchemaVersion;
};

export type ForbiddenAction = { readonly kind: 'forbidden' };

export type SchemaAction = AdvanceAction | ForbiddenAction;

function peerIds(
  ctx: ActionGeneratorContext<SchemaSurface>
): readonly string[] {
  return [SCHEMA_SERVER_ID, ...ctx.nodeIds('client')];
}

export const SCHEMA_ACTIONS = actions<SchemaSurface>()({
  advance: {
    weight: 3,
    generate: (ctx) => {
      const ids = peerIds(ctx);
      const target =
        ids.length === 0
          ? fc.constant(SCHEMA_SERVER_ID)
          : fc.constantFrom(...ids);
      return fc.record({
        kind: fc.constant('advance' as const),
        target,
        to: fc.integer({
          min: 0,
          max: MAX_SCHEMA_VERSION,
        }) as fc.Arbitrary<SchemaVersion>,
      });
    },
    apply: async (surface, payload) => {
      const action = payload as AdvanceAction;
      await applyAdvance(surface, action.target, action.to);
    },
  },
  forbidden: {
    weight: 3,
    generate: () => fc.constant({ kind: 'forbidden' as const }),
    apply: async (surface) => {
      await applyForbidden(surface);
    },
  },
});
