import fc from 'fast-check';
import { MAX_SCHEMA_VERSION, type SchemaVersion } from './schemas';

export type AdvanceAction = {
  readonly kind: 'advance';
  /** Peer node id — the server id or a client id. */
  readonly target: string;
  readonly to: SchemaVersion;
};

export type ForbiddenAction = { readonly kind: 'forbidden' };

export type SchemaAction = AdvanceAction | ForbiddenAction;

export function arbAdvance(
  peerIds: readonly string[]
): fc.Arbitrary<AdvanceAction> {
  return fc.record({
    kind: fc.constant('advance' as const),
    target: fc.constantFrom(...peerIds),
    to: fc.integer({
      min: 0,
      max: MAX_SCHEMA_VERSION,
    }) as fc.Arbitrary<SchemaVersion>,
  });
}

export function arbForbidden(): fc.Arbitrary<ForbiddenAction> {
  return fc.constant({ kind: 'forbidden' as const });
}

export function arbSchemaActions(
  peerIds: readonly string[]
): readonly fc.Arbitrary<SchemaAction>[] {
  return [arbAdvance(peerIds), arbForbidden()];
}
