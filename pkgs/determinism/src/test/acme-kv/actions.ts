import fc from 'fast-check';
import type { JsonValue } from '../../json';
import type { LibraryArbContext } from '../../library';

const KEYS = ['a', 'b', 'c'] as const;
const VALUES = ['x', 'y', 'z', ''] as const;

export function arbPut(ctx: LibraryArbContext): fc.Arbitrary<JsonValue> {
  const clients = ctx.roleIds('client');
  if (clients.length === 0) {
    return fc.constant({ kind: 'put', clientId: 'c0', key: 'a', value: 'x' });
  }
  return fc.record({
    kind: fc.constant('put'),
    clientId: fc.constantFrom(...clients),
    key: fc.constantFrom(...KEYS),
    value: fc.constantFrom(...VALUES),
  });
}

export function arbPartition(ctx: LibraryArbContext): fc.Arbitrary<JsonValue> {
  const clients = ctx.roleIds('client');
  if (clients.length === 0) {
    return fc.constant({ kind: 'partition', clientId: 'c0' });
  }
  return fc.constantFrom(...clients).map((clientId) => ({
    kind: 'partition',
    clientId,
  }));
}

export function arbHeal(): fc.Arbitrary<JsonValue> {
  return fc.constant({ kind: 'heal' });
}

export function asRecord(v: JsonValue): Record<string, unknown> {
  return v as Record<string, unknown>;
}
