import type { QueryRow } from '../queries/core/types';

/** Mutable bag filled by wrapMutationDb during a mutation transaction. */
export type WriteCaptureBag = {
  /** Tables touched (order-stable when read via snapshot). */
  readonly touch: (table: string) => void;
  /** Record post-image rows from RETURNING. */
  readonly addImages: (table: string, rows: readonly QueryRow[]) => void;
  /** Snapshot for fanout / topic map / push tables. */
  readonly snapshot: () => WriteCaptureSnapshot;
};

export type WriteCaptureSnapshot = {
  readonly tables: readonly string[];
  /** Per-table ids when known from RETURNING `id`. */
  readonly ids: Readonly<Record<string, readonly string[]>>;
  /** Per-table post-images keyed by id when present. */
  readonly images: Readonly<Record<string, readonly QueryRow[]>>;
};

export function createWriteCaptureBag(): WriteCaptureBag {
  const tableSet = new Set<string>();
  const idSets = new Map<string, Set<string>>();
  const imageMaps = new Map<string, Map<string, QueryRow>>();

  return {
    touch(table) {
      tableSet.add(table);
    },
    addImages(table, rows) {
      tableSet.add(table);
      let ids = idSets.get(table);
      if (ids === undefined) {
        ids = new Set();
        idSets.set(table, ids);
      }
      let images = imageMaps.get(table);
      if (images === undefined) {
        images = new Map();
        imageMaps.set(table, images);
      }
      for (const row of rows) {
        const id = row['id'];
        if (typeof id === 'string' && id.length > 0) {
          ids.add(id);
          images.set(id, { ...row });
        }
      }
    },
    snapshot() {
      const tables = [...tableSet].sort();
      const ids: Record<string, string[]> = {};
      const images: Record<string, QueryRow[]> = {};
      for (const table of tables) {
        const idSet = idSets.get(table);
        if (idSet !== undefined && idSet.size > 0) {
          ids[table] = [...idSet].sort();
        }
        const img = imageMaps.get(table);
        if (img !== undefined && img.size > 0) {
          images[table] = [...img.keys()]
            .sort()
            .map((id) => img.get(id)!)
            .map((r) => ({ ...r }));
        }
      }
      return { tables, ids, images };
    },
  };
}
