import { action } from '@pkgs/determinism';
import fc from 'fast-check';
import { applyAdvance, applyForbidden } from './dispatch';
import { SCHEMA_SERVER_ID } from './peers';
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

type SchemaWorld = import('@pkgs/determinism').World<
  Record<string, import('@pkgs/determinism').KnobDef>,
  Record<string, import('@pkgs/determinism').NodeSpecEntry>
>;

function peerIds(
  ctx: import('@pkgs/determinism').ActionArbContext
): readonly string[] {
  return [SCHEMA_SERVER_ID, ...ctx.ids('client')];
}

export const advanceAction = action<AdvanceAction, SchemaModel, SchemaWorld>({
  weight: 3,
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

export const forbiddenAction = action<
  ForbiddenAction,
  SchemaModel,
  SchemaWorld
>({
  weight: 3,
  arb: () => fc.constant({ kind: 'forbidden' as const }),
  dispatch: async (world) => {
    await applyForbidden(world);
  },
});

export const SCHEMA_ACTIONS = {
  advance: advanceAction,
  forbidden: forbiddenAction,
} as const;
