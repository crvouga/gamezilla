import type { RegisteredStatusBarItem, StatusBarItemId } from './types';
import { compareStatusBarItems, isStatusBarItemVisible } from './types';

export type StatusBarRegistryListener = () => void;

type Stored = {
  item: RegisteredStatusBarItem;
  /** Unique per `<RegisterStatusBarItem />` mount. */
  registrationId: string;
};

/**
 * In-memory status-bar item map with subscribe semantics for the host.
 */
export class StatusBarRegistryStore {
  private readonly items = new Map<StatusBarItemId, Stored>();
  private readonly listeners = new Set<StatusBarRegistryListener>();
  private version = 0;

  subscribe(fn: StatusBarRegistryListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    this.version += 1;
    for (const fn of this.listeners) {
      fn();
    }
  }

  getVersion(): number {
    return this.version;
  }

  upsert(item: RegisteredStatusBarItem, registrationId: string): void {
    const prev = this.items.get(item.id);
    if (prev !== undefined && prev.registrationId !== registrationId) {
      console.warn(
        `[StatusBarRegistry] Duplicate item id "${item.id}" — last registration wins.`
      );
    }
    this.items.set(item.id, { item, registrationId });
    this.emit();
  }

  remove(id: StatusBarItemId, registrationId: string): void {
    const cur = this.items.get(id);
    if (cur !== undefined && cur.registrationId === registrationId) {
      this.items.delete(id);
      this.emit();
    }
  }

  get(id: StatusBarItemId): RegisteredStatusBarItem | undefined {
    return this.items.get(id)?.item;
  }

  getAll(): RegisteredStatusBarItem[] {
    return [...this.items.values()].map((s) => s.item);
  }

  getVisibleSorted(): RegisteredStatusBarItem[] {
    return this.getAll()
      .filter(isStatusBarItemVisible)
      .sort(compareStatusBarItems);
  }
}
