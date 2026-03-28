import type { PlaygroundSimSnapshot } from '../patch-db/sim/playground-sim';

const DB_NAME = 'playground-sim-persist';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const SNAPSHOT_KEY = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

type StoredSnapshot = {
  serverId: string;
  serverDb: ArrayBuffer;
  clients: {
    id: string;
    db: ArrayBuffer;
    latencyMs: number;
    partitioned: boolean;
  }[];
};

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(u8.byteLength);
  new Uint8Array(buf).set(u8);
  return buf;
}

export async function saveSnapshot(
  snapshot: PlaygroundSimSnapshot
): Promise<void> {
  const stored: StoredSnapshot = {
    serverId: snapshot.serverId,
    serverDb: toArrayBuffer(snapshot.serverDb),
    clients: snapshot.clients.map((c) => ({
      id: c.id,
      db: toArrayBuffer(c.db),
      latencyMs: c.latencyMs,
      partitioned: c.partitioned,
    })),
  };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(stored, SNAPSHOT_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function loadSnapshot(): Promise<PlaygroundSimSnapshot | null> {
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(SNAPSHOT_KEY);
    req.onsuccess = () => {
      db.close();
      const stored = req.result as StoredSnapshot | undefined;
      if (!stored) {
        resolve(null);
        return;
      }
      resolve({
        serverId: stored.serverId,
        serverDb: new Uint8Array(stored.serverDb),
        clients: stored.clients.map((c) => ({
          id: c.id,
          db: new Uint8Array(c.db),
          latencyMs: c.latencyMs,
          partitioned: c.partitioned,
        })),
      });
    };
    req.onerror = () => {
      db.close();
      resolve(null);
    };
  });
}

export async function clearSnapshot(): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(SNAPSHOT_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // IndexedDB not available — nothing to clear
  }
}
