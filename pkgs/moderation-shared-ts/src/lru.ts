/** Bounded least-recently-used map (Map insertion order is recency). */
export class Lru<V> {
  private readonly entries = new Map<string, V>();

  constructor(private readonly capacity: number) {
    if (capacity < 1) throw new Error('Lru capacity must be at least 1');
  }

  get(key: string): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size <= this.capacity) return;
    const oldest = this.entries.keys().next();
    if (oldest.done !== true) this.entries.delete(oldest.value);
  }

  get size(): number {
    return this.entries.size;
  }
}
