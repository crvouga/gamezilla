import fc from 'fast-check';
import { command } from '../../harness/command';
import type { AcmeKvClientHandle, AcmeKvServerHandle } from './nodes';
import { sendPut } from './nodes';

const KEYS = ['a', 'b', 'c'] as const;
const VALUES = ['x', 'y', 'z', ''] as const;

export type PutCommand = {
  readonly kind: 'put';
  readonly clientId: string;
  readonly key: string;
  readonly value: string;
};

export type PutModel = { map: Record<string, string> };

type AcmeWorld = {
  readonly nodes: {
    readonly server: AcmeKvServerHandle;
    readonly client: ReadonlyMap<string, AcmeKvClientHandle>;
  };
};

export const putCommand = command<PutCommand, PutModel, AcmeWorld>({
  weight: 3,
  generate: (ctx) => {
    const clients = ctx.nodeIds('client');
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
  apply: async (world, a) => {
    const client = world.nodes.client.get(a.clientId);
    if (client === undefined) {
      throw new Error(`put: unknown client ${a.clientId}`);
    }
    sendPut({
      server: world.nodes.server,
      client,
      key: a.key,
      value: a.value,
    });
  },
  precondition: () => true,
  applyToModel: (m, a) => {
    m.map[a.key] = a.value;
  },
});
