import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlaygroundSimSnapshot } from '@gamezilla/patch-db/sim/playground-sim';

const SNAPSHOT_KEY = 'playground-sim-snapshot';

function uint8ToBase64(u8: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < u8.byteLength; i++) {
    binary += String.fromCharCode(u8[i]!);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

type StoredSnapshot = {
  serverId: string;
  serverDb: string;
  clients: {
    id: string;
    db: string;
    latencyMs: number;
    partitioned: boolean;
  }[];
};

export async function saveSnapshot(
  snapshot: PlaygroundSimSnapshot
): Promise<void> {
  const stored: StoredSnapshot = {
    serverId: snapshot.serverId,
    serverDb: uint8ToBase64(snapshot.serverDb),
    clients: snapshot.clients.map((c) => ({
      id: c.id,
      db: uint8ToBase64(c.db),
      latencyMs: c.latencyMs,
      partitioned: c.partitioned,
    })),
  };
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(stored));
}

export async function loadSnapshot(): Promise<PlaygroundSimSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const stored: StoredSnapshot = JSON.parse(raw);
    return {
      serverId: stored.serverId,
      serverDb: base64ToUint8(stored.serverDb),
      clients: stored.clients.map((c) => ({
        id: c.id,
        db: base64ToUint8(c.db),
        latencyMs: c.latencyMs,
        partitioned: c.partitioned,
      })),
    };
  } catch {
    return null;
  }
}

export async function clearSnapshot(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // storage not available
  }
}
