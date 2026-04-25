import { Assert } from '@gamezilla/lib/assert';
import type {
  PeerStorePersistence,
  PeerStorePersistenceEntry,
} from './peer-store-persistence';

const crash: Assert = Assert.crash();

/**
 * In-memory persistence journal backed by a Map. Useful for tests and local dev.
 */
export class InMemoryPeerStorePersistence implements PeerStorePersistence {
  private readonly store = new Map<string, PeerStorePersistenceEntry[]>();

  async append(partitionKey: string, entry: PeerStorePersistenceEntry): Promise<void> {
    crash.nonEmptyString(partitionKey, 'partitionKey must be non-empty');
    const rows = this.store.get(partitionKey) ?? [];
    rows.push(entry);
    this.store.set(partitionKey, rows);
  }

  async load(partitionKey: string): Promise<PeerStorePersistenceEntry[]> {
    crash.nonEmptyString(partitionKey, 'partitionKey must be non-empty');
    return [...(this.store.get(partitionKey) ?? [])];
  }
}
