import fc from 'fast-check';
import type { ActionArbContext } from '../../action';
import { defineAction } from '../../action';
import type { JsonValue } from '../../json';
import { sendPut } from './nodes';
import type { AcmeKvSystem } from './types';

const KEYS = ['a', 'b', 'c'] as const;
const VALUES = ['x', 'y', 'z', ''] as const;

export type PutAction = {
  readonly kind: 'put';
  readonly clientId: string;
  readonly key: string;
  readonly value: string;
};

export type PutModel = { map: Record<string, string> };

export const putAction = defineAction<AcmeKvSystem, PutAction, PutModel>({
  kind: 'put',
  class: 'domain',
  arb: (ctx: ActionArbContext) => {
    const clients = ctx.roleIds('client');
    if (clients.length === 0) {
      return fc.constant({
        kind: 'put' as const,
        clientId: 'c0',
        key: 'a',
        value: 'x',
      });
    }
    return fc.record({
      kind: fc.constant('put' as const),
      clientId: fc.constantFrom(...clients),
      key: fc.constantFrom(...KEYS),
      value: fc.constantFrom(...VALUES),
    });
  },
  dispatch: async (world, action) => {
    sendPut({
      state: world.state,
      clientId: action.clientId,
      key: action.key,
      value: action.value,
    });
  },
  allows: () => true,
  apply: (m, action) => {
    m.map[action.key] = action.value;
  },
});

export function asRecord(v: JsonValue): Record<string, unknown> {
  return v as Record<string, unknown>;
}
