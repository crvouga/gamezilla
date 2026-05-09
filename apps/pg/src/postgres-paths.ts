/**
 * Resolved file system layout for the managed local Postgres cluster owned by
 * `@gamezilla/pg`. Single source of truth so start/stop/kill all agree.
 *
 * Cross-platform: paths are built with `node:path` so they work on macOS,
 * Linux, and WSL (and at least don't trip on Windows separators).
 */

import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

/** `apps/pg/` (the package root). */
export const APP_ROOT: string = resolve(SCRIPT_DIR, '..');

/**
 * App-local state directory. Renamed from `.pglite` to make the new lifecycle
 * obvious; ignored by git.
 */
export const STATE_DIR: string = resolve(APP_ROOT, '.postgres');

/** PostgreSQL cluster directory passed to `initdb -D` / `pg_ctl -D`. */
export const DATA_DIR: string = resolve(STATE_DIR, 'data');

/** Holds our own PID file + log so they're never confused with cluster files. */
export const RUN_DIR: string = resolve(STATE_DIR, 'run');

/**
 * PID of the wrapper process (this Bun script), not the postmaster. Used by
 * `kill` to find / signal the right wrapper without touching unrelated
 * processes that happen to listen on the same port.
 */
export const WRAPPER_PID_FILE: string = resolve(RUN_DIR, 'wrapper.pid');

/** Postmaster log (pg server stderr/stdout). */
export const LOG_FILE: string = resolve(RUN_DIR, 'postgres.log');

/** pgweb GUI sidecar log (stdout/stderr from the spawned pgweb process). */
export const GUI_LOG_FILE: string = resolve(RUN_DIR, 'pgweb.log');

/**
 * Resolve a possibly-relative path from a `PG_*` env var into an absolute path
 * rooted at the app dir. Lets developers do `PG_DATA_DIR=./scratch` without
 * surprises.
 */
export function resolveFromAppRoot(raw: string): string {
  return isAbsolute(raw) ? raw : resolve(APP_ROOT, raw);
}
