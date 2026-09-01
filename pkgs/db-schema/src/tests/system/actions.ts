import { type ActionArbContext, defineAction } from '@pkgs/determinism';
import fc from 'fast-check';
import { applyAdvance, applyForbidden } from './dispatch';
import { SCHEMA_SERVER_ID, type SchemaSystem } from './peers';
import { MAX_SCHEMA_VERSION, type SchemaVersion } from './schemas';

export type AdvanceAction = {
  readonly kind: 'advance';
  /** Peer node id — the server id or a client id. */
  readonly target: string;
  readonly to: SchemaVersion;
};

export type ForbiddenAction = { readonly kind: 'forbidden' };

export type SchemaAction = AdvanceAction | ForbiddenAction;

export type SchemaModel = Record<string, never>;

function peerIds(ctx: ActionArbContext): readonly string[] {
  return [SCHEMA_SERVER_ID, ...ctx.roleIds('client')];
}

export const advanceAction = defineAction<
  SchemaSystem,
  AdvanceAction,
  SchemaModel
>({
  kind: 'advance',
  class: 'domain',
  arb: (ctx) => {
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
  dispatch: async (world, action) => {
    await applyAdvance(world, action.target, action.to);
  },
});

export const forbiddenAction = defineAction<
  SchemaSystem,
  ForbiddenAction,
  SchemaModel
>({
  kind: 'forbidden',
  class: 'domain',
  arb: () => fc.constant({ kind: 'forbidden' as const }),
  dispatch: async (world) => {
    await applyForbidden(world);
  },
});

export const SCHEMA_ACTIONS = [advanceAction, forbiddenAction] as const;
