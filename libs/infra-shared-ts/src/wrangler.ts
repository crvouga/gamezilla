/**
 * Env-agnostic `wrangler.toml` + one environment → the config wrangler
 * deploys with. The committed TOML holds only code config (entry point,
 * compatibility, Durable Object classes and migrations, crons); the Worker's
 * name comes from the environment file, and public hostnames belong to the OpenTofu
 * edge stack — never to wrangler.
 *
 * The rendered file is written to `<app>/.cache/`, one directory below the
 * TOML, so relative paths are re-rooted by one level. The TOML spells no
 * product name: `{namespace}` / `{domain}` / `{brand}` in it resolve from
 * the product identity here.
 */

import { resolveIdentityPlaceholders } from '@libs/product-identity-shared-ts/identity-placeholders';
import type { EnvFile } from './env-file';
import { apiWorkerVars, authRelayTargets } from './env-file';
import { ENV_FILES } from './envs';
import { GLOBAL } from './global';
import type { RoomMigration } from './worker-lifecycle';

export type WranglerConfig = Record<string, unknown>;

/**
 * Ids of resources OpenTofu created for the environment that a Worker binds
 * (read from the secrets store at deploy time: foundation writes them).
 */
export type WorkerResources = {
  /** The API Worker's Postgres connection (`modules/database` Hyperdrive). */
  readonly hyperdriveId?: string;
  readonly roomMigrations?: readonly RoomMigration[];
};

/** The API Worker's binding name for Hyperdrive (`ApiWorkerEnv.HYPERDRIVE`). */
export const HYPERDRIVE_BINDING = 'HYPERDRIVE';

type Migration = {
  readonly tag: string;
  readonly deleted_classes?: readonly string[];
};

export function workerName(env: EnvFile): string {
  return env.worker.name;
}

function reroot(path: string): string {
  return path.startsWith('/') ? path : `../${path.replace(/^\.\//, '')}`;
}

function rerootedAssets(assets: unknown): unknown {
  if (typeof assets !== 'object' || assets === null) return assets;
  const record = assets as Record<string, unknown>;
  const directory = record['directory'];
  return typeof directory === 'string'
    ? { ...record, directory: reroot(directory) }
    : record;
}

/**
 * Durable Object migrations may add or rename classes, never delete one: a
 * deleted class takes every object's storage with it.
 */
export function deletedDurableObjectClasses(
  base: WranglerConfig
): readonly string[] {
  const migrations = (base['migrations'] ?? []) as readonly Migration[];
  return migrations.flatMap((m) => m.deleted_classes ?? []);
}

/**
 * The cloud region each PlanetScale region runs in. Add a region here when the
 * database moves; an unlisted one fails the render rather than guessing.
 */
const DATABASE_CLOUD_REGION: Readonly<Record<string, string>> = {
  'us-east': 'aws:us-east-1',
  'us-west': 'aws:us-west-2',
  'eu-west': 'aws:eu-west-1',
  'eu-central': 'aws:eu-central-1',
};

/**
 * Where the API Worker runs. A request sends dozens of statements to Postgres,
 * each a round trip through Hyperdrive, and Cloudflare otherwise runs the
 * Worker wherever the caller enters its network: a request from the other side
 * of the continent pays that distance on every statement. Placing the Worker
 * beside the database pays it once per request.
 */
export function databasePlacement(databaseRegion: string): {
  readonly region: string;
} {
  const region = DATABASE_CLOUD_REGION[databaseRegion];
  if (region === undefined) {
    throw new Error(
      `No cloud region is known for the database region '${databaseRegion}'; add it to DATABASE_CLOUD_REGION in libs/infra-shared-ts/src/wrangler.ts`
    );
  }
  return { region };
}

function assertEnvAgnostic(base: WranglerConfig): void {
  const deleted = deletedDurableObjectClasses(base);
  if (deleted.length > 0) {
    throw new Error(
      `wrangler config deletes Durable Object classes (${deleted.join(', ')}); that destroys their storage and is never allowed.`
    );
  }
  if ('placement' in base) {
    throw new Error(
      'wrangler.toml must not set placement: it is derived from the database region in libs/infra-shared-ts/tofu/global.tfvars.json.'
    );
  }
  if ('env' in base || 'routes' in base || 'route' in base) {
    throw new Error(
      'wrangler.toml must stay env-agnostic: no [env.*], routes or route (hostnames belong to libs/infra-shared-ts/tofu).'
    );
  }
}

export function renderWranglerConfig(
  committed: WranglerConfig,
  env: EnvFile,
  resources: WorkerResources = {}
): WranglerConfig {
  const base = resolveIdentityPlaceholders(committed);
  assertEnvAgnostic(base);
  const rendered: WranglerConfig = {
    ...base,
    name: workerName(env),
    // Absent in local `wrangler dev`: tells deployed telemetry which
    // environment it is (every environment shares one trace stack), and the
    // runtime whether it is production — read from the env file's
    // `protection`, never inferred from the environment's name. Absent means
    // non-production.
    vars: {
      ...((base['vars'] as Record<string, string> | undefined) ?? {}),
      DEPLOYMENT_ENVIRONMENT: env.env,
      DEPLOYMENT_PROTECTION: env.protection,
      ...apiWorkerVars(env),
    },
  };
  rendered['placement'] = databasePlacement(GLOBAL.planetscale.region);
  if (resources.hyperdriveId !== undefined) {
    rendered['hyperdrive'] = [
      { binding: HYPERDRIVE_BINDING, id: resources.hyperdriveId },
    ];
  }
  if (typeof base['main'] === 'string') rendered['main'] = reroot(base['main']);
  if ('assets' in base) rendered['assets'] = rerootedAssets(base['assets']);
  if (resources.roomMigrations !== undefined) {
    const migrations = (base['migrations'] ?? []) as readonly Migration[];
    for (const replacement of resources.roomMigrations) {
      if (!migrations.some((migration) => migration.tag === replacement.tag)) {
        throw new Error(
          `Room migration ${replacement.tag} is missing from the committed config`
        );
      }
    }
    rendered['migrations'] = migrations.map(
      (migration) =>
        resources.roomMigrations?.find((item) => item.tag === migration.tag) ??
        migration
    );
  }
  return rendered;
}

/**
 * The global OAuth callback relay (`apps/auth-relay-ts`): one Worker for every
 * environment, named in `global.tfvars.json`, forwarding to every env file.
 */
export function renderAuthRelayWranglerConfig(
  committed: WranglerConfig
): WranglerConfig {
  const base = resolveIdentityPlaceholders(committed);
  assertEnvAgnostic(base);
  const rendered: WranglerConfig = {
    ...base,
    name: GLOBAL.auth_relay.worker,
    vars: {
      ...((base['vars'] as Record<string, string> | undefined) ?? {}),
      OAUTH_RELAY_TARGETS: JSON.stringify(
        authRelayTargets(Object.values(ENV_FILES))
      ),
    },
  };
  if (typeof base['main'] === 'string') rendered['main'] = reroot(base['main']);
  return rendered;
}
