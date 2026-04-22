import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlaygroundSimSnapshot } from '@gamezilla/patch-db/sim/playground-sim';

const SNAPSHOT_KEY = 'playground-sim-snapshot';

export async function saveSnapshot(
  snapshot: PlaygroundSimSnapshot
): Promise<void> {
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export async function loadSnapshot(): Promise<PlaygroundSimSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlaygroundSimSnapshot;
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
