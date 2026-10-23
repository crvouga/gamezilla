/**
 * How a package's structure bindings (`tests/alloy/*.binding.ts`) get their
 * snapshots: each scenario opens a fresh harness (the package's composition,
 * on virtual time),
 * plays what people do through harness actions, and then reads what the
 * product stored — the server's Postgres-dialect database and every device's
 * own SQLite — through a projection into the model's atoms and relations.
 *
 * These are storage adapters (strategy § 7): they read rows with SQL through
 * the database handles the harness exposes (`harness.serverSql`,
 * `actorLocalSql`), never product internals. Stored ids are renamed to the
 * actor who holds them (an account id reads as `alice`), so a report of an
 * illegal world names people; ids nobody holds stay as stored.
 */

import { DEVICE_ID_KEY } from '@libs/auth-shared-ts/auth-storage-keys';
import type { Snapshot } from '@pkgs/alloy-shared-ts/world';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { ProductHarness } from './harness';
import { accountIdOf, actorLocalSql } from './identity';
import type { OpenHarness } from './open-harness';

/** Stored id → the name a report shows for it. */
export type Names = (id: string) => string;

/** The atoms and relations a store projects to, before it is labelled. */
export type World = Omit<Snapshot, 'label'>;

/** Which kind of store a projection reads: some tables live only on one. */
export type Store = 'server' | 'device';

/** Rows → a world. */
export type Projection = (
  db: SqlTx,
  names: Names,
  store: Store
) => Promise<World>;

/**
 * Read every store now, as well as at the scenario's end: `moment` says when,
 * in product words (`after alice asks bob`).
 */
export type Capture = (moment: string) => Promise<void>;

export type Scenario = {
  /** What the people did, in product words: the snapshot's label. */
  readonly name: string;
  readonly run: (s: OpenHarness, capture: Capture) => Promise<void>;
};

export type StoredWorlds = {
  readonly server: readonly Snapshot[];
  readonly device: readonly Snapshot[];
};

type OpenPackageHarness = (testId: string) => Promise<OpenHarness>;

async function deviceIdOf(
  h: ProductHarness,
  actorId: string
): Promise<string | null> {
  const env = await h.harness.client(actorId);
  const id = env.secureStorage.getValue(DEVICE_ID_KEY);
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** `name`, or `name (2)`, … — whichever no other id holds yet. */
function unused(taken: ReadonlySet<string>, name: string): string {
  let candidate = name;
  for (let n = 2; taken.has(candidate); n += 1) {
    candidate = `${name} (${String(n)})`;
  }
  return candidate;
}

/**
 * Name each actor's account (their person), the guest their device is now if
 * it holds no account, and their device, by the actor's name. `names` carries
 * the names given earlier in the scenario, so an account keeps its name after
 * its person signs out. Names stay one-to-one with ids, so renaming keeps
 * every atom distinct.
 */
async function nameActors(
  h: ProductHarness,
  names: Map<string, string>
): Promise<void> {
  const taken = new Set(names.values());
  const give = (id: string | null, name: string) => {
    if (id === null || names.has(id)) return;
    const unique = unused(taken, name);
    names.set(id, unique);
    taken.add(unique);
  };
  const server = h.harness.serverSql.sqlClient;
  for (const actorId of [...h.actors.keys()].sort()) {
    give(await accountIdOf(h, actorId), actorId);
    give(await selfOf(server, h, actorId), actorId);
    give(await deviceIdOf(h, actorId), `device of ${actorId}`);
  }
}

/** The person a device's own store belongs to: who its install is now. */
async function selfOf(
  db: SqlTx,
  h: ProductHarness,
  actorId: string
): Promise<string | null> {
  const device = await deviceIdOf(h, actorId);
  if (device === null) return null;
  const rows = await db.query(sql<{ readonly user_id: string | null }>`
    SELECT user_id FROM auth_devices
    WHERE id = ${device} AND deleted_at IS NULL`);
  return rows[0]?.user_id ?? null;
}

async function readStores(
  h: ProductHarness,
  label: string,
  project: Projection,
  table: Map<string, string>
): Promise<StoredWorlds> {
  await nameActors(h, table);
  const names: Names = (id) => table.get(id) ?? id;
  const server: Snapshot = {
    label: `server database ${label}`,
    ...(await project(h.harness.serverSql.sqlClient, names, 'server')),
  };
  const device: Snapshot[] = [];
  for (const actorId of [...h.actors.keys()].sort()) {
    const db = actorLocalSql(h, actorId);
    if (db === null) continue;
    device.push({
      label: `device of ${actorId} ${label}`,
      ...(await project(db, names, 'device')),
    });
  }
  return { server: [server], device };
}

/**
 * Play every scenario in its own harness and read both kinds of store at its
 * end, and wherever it captures on the way. Scenarios run one after another;
 * the result is a function of the scripts alone (virtual time, the harness's
 * pinned seed).
 */
export async function captureWorlds(
  open: OpenPackageHarness,
  scenarios: readonly Scenario[],
  project: Projection
): Promise<StoredWorlds> {
  const server: Snapshot[] = [];
  const device: Snapshot[] = [];
  for (const [index, scenario] of scenarios.entries()) {
    const slug = scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await using s = await open(`alloy-${String(index)}-${slug}`);
    const table = new Map<string, string>();
    const read = async (label: string) => {
      const stored = await s.read((h) => readStores(h, label, project, table));
      server.push(...stored.server);
      device.push(...stored.device);
    };
    await scenario.run(s, (moment) => read(`in: ${scenario.name}, ${moment}`));
    await read(`after: ${scenario.name}`);
  }
  return { server, device };
}

type WorldsRegistry = Map<string, Promise<StoredWorlds>>;

const WORLDS_KEY = Symbol.for('harness.alloy.stored-worlds');

/**
 * A structure's stored worlds, built once and shared by all its adapters: the
 * server-database and device-database adapters read the same runs, so the
 * scenarios play once per structure (per process), never once per adapter.
 */
export function sharedWorlds(
  structure: string,
  build: () => Promise<StoredWorlds>
): () => Promise<StoredWorlds> {
  return () => {
    const host = globalThis as { [WORLDS_KEY]?: WorldsRegistry };
    host[WORLDS_KEY] ??= new Map();
    const registry = host[WORLDS_KEY];
    let pending = registry.get(structure);
    if (pending === undefined) {
      pending = build();
      registry.set(structure, pending);
    }
    return pending;
  };
}
