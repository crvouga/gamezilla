import { command } from '@pkgs/dst';
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

type SchemaWorld = import('@pkgs/dst').World<
  Record<string, import('@pkgs/dst').KnobDef>,
  Record<string, import('@pkgs/dst').NodeEntry>
>;

function peerIds(
  ctx: import('@pkgs/dst').CommandGeneratorContext
): readonly string[] {
  return [SCHEMA_SERVER_ID, ...ctx.nodeIds('client')];
}

export const advanceAction = command<AdvanceAction, SchemaModel, SchemaWorld>({
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
  apply: async (world, action) => {
    await applyAdvance(world, action.target, action.to);
  },
});

export const forbiddenAction = command<
  ForbiddenAction,
  SchemaModel,
  SchemaWorld
>({
  weight: 3,
  generate: () => fc.constant({ kind: 'forbidden' as const }),
  apply: async (world) => {
    await applyForbidden(world);
  },
});

export const SCHEMA_ACTIONS = {
  advance: advanceAction,
  forbidden: forbiddenAction,
} as const;
