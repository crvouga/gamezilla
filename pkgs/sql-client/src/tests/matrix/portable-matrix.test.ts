import { describe } from 'bun:test';
import type { SqlClient } from '../../interface';
import { ALWAYS_FACTORIES, type MatrixBackend, openBackend } from '../backends';
import { runPortableContractTests } from '../contract/portable-contract';

type MatrixEntry = {
  readonly name: string;
  readonly dialect: 'sqlite' | 'postgres';
  readonly shared: boolean;
  readonly createClient: () => Promise<SqlClient>;
};

async function buildMatrix(): Promise<MatrixEntry[]> {
  const entries: MatrixEntry[] = [];
  for (const factory of ALWAYS_FACTORIES) {
    if (factory.kind === 'pglite') {
      const shared: MatrixBackend = await openBackend(factory);
      entries.push({
        name: factory.name,
        dialect: factory.dialect,
        shared: true,
        createClient: async () => shared.client,
      });
      continue;
    }
    entries.push({
      name: factory.name,
      dialect: factory.dialect,
      shared: false,
      createClient: async () => {
        const backend = await openBackend(factory);
        return backend.client;
      },
    });
  }
  return entries;
}

const implementations = await buildMatrix();

describe.each(implementations)(
  'portable contract — $name',
  ({ name, dialect, shared, createClient }) => {
    runPortableContractTests(createClient, { name, dialect, shared });
  }
);
