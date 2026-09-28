import { readUtf8, writeUtf8 } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';

import {
  decodeNotebookDoc,
  encodeNotebookDoc,
  type SqlNotebookDoc,
} from './notebook-doc';

export type NotebookStore = {
  load(nodeId: string): Promise<SqlNotebookDoc | null>;
  save(doc: SqlNotebookDoc): Promise<void>;
  clear(nodeId: string): Promise<void>;
};

export function createNotebookStore(store: ObjectStore): NotebookStore {
  return {
    async load(nodeId) {
      const raw = await readUtf8(store, notebookKey(nodeId));
      if (raw === null) return null;
      return decodeNotebookDoc(raw, nodeId);
    },
    async save(doc) {
      await writeUtf8(
        store,
        notebookKey(doc.nodeId),
        encodeNotebookDoc(doc),
        'application/json'
      );
    },
    async clear(nodeId) {
      await store.delete(notebookKey(nodeId));
    },
  };
}

function notebookKey(nodeId: string): string {
  return `${nodeId}.json`;
}
