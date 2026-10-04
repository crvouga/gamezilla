import type { SqlCliFn } from './types';

export type AttachToGlobalConfig = {
  /** Global property name. Defaults to `q`. */
  name?: string;
};

/**
 * Attach a tagged-template SQL CLI to `globalThis` (and `window` when present)
 * so it can be used from a browser console: `await q\`SELECT 1\``.
 */
export function attachToGlobal(
  sql: SqlCliFn,
  config: AttachToGlobalConfig = {}
): void {
  const name = config.name ?? 'q';
  Reflect.set(globalThis, name, sql);

  const win = Reflect.get(globalThis, 'window');
  if (win !== undefined && win !== null && typeof win === 'object') {
    Reflect.set(win, name, sql);
  }
}
