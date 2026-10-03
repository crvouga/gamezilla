/**
 * Env-agnostic `wrangler.toml` + one environment → the config wrangler
 * deploys with. The committed TOML holds only code config (entry point,
 * compatibility, Durable Object classes and migrations, crons); the Worker's
 * name comes from the environment file, and public hostnames belong to the OpenTofu
 * edge stack — never to wrangler.
 *
 * The rendered file is written to `<app>/.cache/`, one directory below the
 * TOML, so relative paths are re-rooted by one level.
 */
import { apiWorkerVars, authRelayTargets, type EnvFile } from './env-file';
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

function assertEnvAgnostic(base: WranglerConfig): void {
  const deleted = deletedDurableObjectClasses(base);
  if (deleted.length > 0) {
    throw new Error(
      `wrangler config deletes Durable Object classes (${deleted.join(', ')}); that destroys their storage and is never allowed.`
    );
  }
  if ('env' in base || 'routes' in base || 'route' in base) {
    throw new Error(
      'wrangler.toml must stay env-agnostic: no [env.*], routes or route (hostnames belong to libs/infra/tofu).'
    );
  }
}

export function renderWranglerConfig(
  base: WranglerConfig,
  env: EnvFile,
  resources: WorkerResources = {}
): WranglerConfig {
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
 * The global OAuth callback relay (`apps/auth-relay`): one Worker for every
 * environment, named in `global.tfvars.json`, forwarding to every env file.
 */
export function renderAuthRelayWranglerConfig(
  base: WranglerConfig
): WranglerConfig {
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
