/**
 * Env-agnostic `wrangler.toml` + one environment → the config wrangler
 * deploys with. The committed TOML holds only code config (entry point,
 * compatibility, Durable Object classes and migrations, crons); the Worker's
 * name and the cross-script Durable Object `script_name` come from the
 * environment's naming patterns, and public hostnames belong to the OpenTofu
 * edge stack — never to wrangler.
 *
 * The rendered file is written to `<app>/.cache/`, one directory below the
 * TOML, so relative paths are re-rooted by one level.
 */
import type { EnvFile } from './env-file';
import { envResourceNames } from './naming';

export type WorkerRole = 'api' | 'room' | 'web';

export type WranglerConfig = Record<string, unknown>;

type DurableObjectBinding = {
  readonly name: string;
  readonly class_name: string;
  readonly script_name?: string;
};

type Migration = {
  readonly tag: string;
  readonly deleted_classes?: readonly string[];
};

const ROOM_CLASS = 'RoomServerDurableObject';

export function workerName(env: EnvFile, role: WorkerRole): string {
  const names = envResourceNames(env);
  if (role === 'api') return names.api_worker;
  if (role === 'room') return names.room_worker;
  return names.web_worker;
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

function boundDurableObjects(
  base: WranglerConfig,
  env: EnvFile,
  role: WorkerRole
): unknown {
  const durable = base['durable_objects'] as
    | { bindings?: readonly DurableObjectBinding[] }
    | undefined;
  if (durable?.bindings === undefined) return durable;
  const bindings = durable.bindings.map((binding) =>
    role !== 'room' && binding.class_name === ROOM_CLASS
      ? { ...binding, script_name: workerName(env, 'room') }
      : binding
  );
  return { ...durable, bindings };
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

export function renderWranglerConfig(
  base: WranglerConfig,
  env: EnvFile,
  role: WorkerRole
): WranglerConfig {
  const deleted = deletedDurableObjectClasses(base);
  if (deleted.length > 0) {
    throw new Error(
      `wrangler config deletes Durable Object classes (${deleted.join(', ')}); that destroys their storage and is never allowed.`
    );
  }
  if ('env' in base || 'routes' in base || 'route' in base) {
    throw new Error(
      'wrangler.toml must stay env-agnostic: no [env.*], routes or route (hostnames belong to libs/infra/tofu edge).'
    );
  }
  const rendered: WranglerConfig = { ...base, name: workerName(env, role) };
  if (typeof base['main'] === 'string') rendered['main'] = reroot(base['main']);
  if ('assets' in base) rendered['assets'] = rerootedAssets(base['assets']);
  if ('durable_objects' in base) {
    rendered['durable_objects'] = boundDurableObjects(base, env, role);
  }
  return rendered;
}
