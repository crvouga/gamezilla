import type { Awaitable } from '../system/awaitable';
import type { SnapshotMedia } from './types';

export const SNAPSHOT_TAG = Symbol.for('dst.Snapshot');

export type SnapshotDef<S, T = unknown> = {
  readonly name: string;
  /** Encoding / render hint. Default `json`. */
  readonly media?: SnapshotMedia;
  /**
   * Capture a value from the surface. `null` / `undefined` skips.
   * For `html` / `png` / `text`, a `Record<nodeId, string | Uint8Array>`
   * splits into per-node blobs.
   */
  readonly capture: (s: S) => Awaitable<T | null | undefined>;
};

export type Snapshot<S, T = unknown> = {
  readonly [SNAPSHOT_TAG]: true;
  readonly name: string;
  readonly media: SnapshotMedia;
  readonly capture: (s: S) => Awaitable<T | null | undefined>;
};

/** Existential snapshot for catalogs. */
export type CatalogSnapshot<S> = {
  readonly [SNAPSHOT_TAG]: true;
  readonly name: string;
  readonly media: SnapshotMedia;
  readonly capture: (s: S) => Awaitable<unknown>;
};

export function defineSnapshot<S, T = unknown>(
  def: SnapshotDef<S, T>
): Snapshot<S, T> {
  if (!def.name) throw new Error('defineSnapshot: name is required');
  return {
    [SNAPSHOT_TAG]: true,
    name: def.name,
    media: def.media ?? 'json',
    capture: def.capture,
  };
}

export function isSnapshot(v: unknown): v is Snapshot<unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    SNAPSHOT_TAG in v &&
    (v as { [SNAPSHOT_TAG]?: boolean })[SNAPSHOT_TAG] === true
  );
}
