import { installPostgresSqliteCompat } from '@pkgs/postgres-sqlite-compat-shared/install';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server/impl-mockingbird-postgres';
import { createPostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-server/impl-bun-sqlite';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-shared/impl-mockingbird-sqlite';
import { dropTables } from './drop-tables';
import type { BackendFactory, MatrixBackend } from './types';

const FIXED_NOW = () => new Date('2020-01-01T00:00:00.000Z');

type EphemeralArgs = {
  readonly kind: MatrixBackend['kind'];
  readonly name: string;
  readonly dialect: MatrixBackend['dialect'];
  readonly client: MatrixBackend['client'];
  readonly disconnect: () => Promise<void>;
};

function ephemeral(args: EphemeralArgs): MatrixBackend {
  const { kind, name, dialect, client, disconnect } = args;
  return {
    kind,
    name,
    dialect,
    client,
    cleanup: async (tables) => {
      await dropTables(client, tables, dialect);
    },
    close: disconnect,
  };
}

export const MOCKINGBIRD_SQLITE_FACTORY: BackendFactory = {
  kind: 'mockingbird-sqlite',
  name: 'mockingbird-sqlite',
  dialect: 'sqlite',
  always: true,
  open: async () => {
    const client = SqlClientImplMockingbirdSqlite.open({
      seed: 1,
      now: FIXED_NOW,
    });
    await client.connect();
    return ephemeral({
      kind: 'mockingbird-sqlite',
      name: 'mockingbird-sqlite',
      dialect: 'sqlite',
      client,
      disconnect: () => client.disconnect(),
    });
  },
};

export const BUN_SQLITE_FACTORY: BackendFactory = {
  kind: 'bun-sqlite',
  name: 'bun-sqlite',
  dialect: 'sqlite',
  always: true,
  open: async () => {
    const client = SqlClientImplBunSqlite.open(':memory:');
    await client.connect();
    return ephemeral({
      kind: 'bun-sqlite',
      name: 'bun-sqlite',
      dialect: 'sqlite',
      client,
      disconnect: () => client.disconnect(),
    });
  },
};

export const MOCKINGBIRD_POSTGRES_FACTORY: BackendFactory = {
  kind: 'mockingbird-postgres',
  name: 'mockingbird-postgres',
  dialect: 'postgres',
  always: true,
  open: async () => {
    const client = SqlClientImplMockingbirdPostgres.open({
      seed: 1,
      now: FIXED_NOW,
      dbScope: createPostgresDbScope('public'),
    });
    await client.connect();
    return ephemeral({
      kind: 'mockingbird-postgres',
      name: 'mockingbird-postgres',
      dialect: 'postgres',
      client,
      disconnect: () => client.disconnect(),
    });
  },
};

async function trySqliteWasm(): Promise<BackendFactory | null> {
  try {
    const { SqlClientImplSqliteWasm } = await import(
      '@pkgs/sql-client-sqlite-client/impl-sqlite-wasm'
    );
    return {
      kind: 'sqlite-wasm',
      name: 'sqlite-wasm',
      dialect: 'sqlite',
      always: false,
      open: async () => {
        const client = await SqlClientImplSqliteWasm.open();
        await client.connect();
        return ephemeral({
          kind: 'sqlite-wasm',
          name: 'sqlite-wasm',
          dialect: 'sqlite',
          client,
          disconnect: () => client.disconnect(),
        });
      },
    };
  } catch {
    return null;
  }
}

/** Factories that should always load in bun unit / PBT. */
export const ALWAYS_FACTORIES: readonly BackendFactory[] = [
  MOCKINGBIRD_SQLITE_FACTORY,
  BUN_SQLITE_FACTORY,
  MOCKINGBIRD_POSTGRES_FACTORY,
];

let cachedAvailable: BackendFactory[] | null = null;

/** Always factories + optional ones that boot successfully once. */
export async function loadAvailableFactories(): Promise<
  readonly BackendFactory[]
> {
  if (cachedAvailable !== null) return cachedAvailable;
  const out: BackendFactory[] = [...ALWAYS_FACTORIES];
  const wasm = await trySqliteWasm();
  if (wasm !== null) {
    try {
      const probe = await wasm.open();
      await probe.close();
      out.push(wasm);
    } catch {
      // WASM unavailable in this runner
    }
  }
  cachedAvailable = out;
  return out;
}

export async function openBackend(
  factory: BackendFactory
): Promise<MatrixBackend> {
  const backend = await factory.open();
  if (
    factory.dialect === 'postgres' &&
    factory.kind === 'mockingbird-postgres'
  ) {
    // mockingbird-postgres installs mem JSON1 shims in open().
    return backend;
  }
  if (factory.dialect === 'postgres') {
    await installPostgresSqliteCompat({ sqlClient: backend.client });
  }
  return backend;
}

export function factoriesForDialect(
  factories: readonly BackendFactory[],
  dialect: 'sqlite' | 'postgres'
): BackendFactory[] {
  return factories.filter((f) => f.dialect === dialect);
}
