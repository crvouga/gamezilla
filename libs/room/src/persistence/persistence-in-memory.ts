import { Assert } from '@gamezilla/lib/assert';
import type {
  RoomPersistence,
  RoomPersistenceEntry,
} from './persistence';

const crash: Assert = Assert.crash();

/**
 * In-memory persistence journal backed by a Map. Useful for tests and local dev.
 */
export class InMemoryRoomPersistence implements RoomPersistence {
  private readonly store = new Map<string, RoomPersistenceEntry[]>();

  async append(partitionKey: string, entry: RoomPersistenceEntry): Promise<void> {
    crash.nonEmptyString(partitionKey, 'partitionKey must be non-empty');
    const rows = this.store.get(partitionKey) ?? [];
    rows.push(entry);
    this.store.set(partitionKey, rows);
  }

  async load(partitionKey: string): Promise<RoomPersistenceEntry[]> {
    crash.nonEmptyString(partitionKey, 'partitionKey must be non-empty');
    return [...(this.store.get(partitionKey) ?? [])];
  }
}
