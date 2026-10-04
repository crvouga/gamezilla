import type { DurableObjectKvStorage, DurableObjectKvTransaction } from '@pkgs/room-adapter-durable-object-shared/types';

/** A persistence port with rollback and literal interrupted-write boundaries. */
export class MemoryKv implements DurableObjectKvStorage {
  values = new Map<string, unknown>();
  interruptAfterEventWrite = false;
  interruptAfterTransaction = false;
  failPutNumber: number | null = null;
  puts = 0;

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void>;
  async put(entries: Record<string, unknown>): Promise<void>;
  async put(
    key: string | Record<string, unknown>,
    value?: unknown
  ): Promise<void> {
    this.puts++;
    if (this.puts === this.failPutNumber) throw new Error('interrupted write');
    const entries = typeof key === 'string' ? { [key]: value } : key;
    for (const [name, item] of Object.entries(entries))
      this.values.set(name, item);
    if (
      this.interruptAfterEventWrite &&
      Object.keys(entries).some((name) => name.includes('.e.'))
    ) {
      this.interruptAfterEventWrite = false;
      throw new Error('stopped after event write');
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.values.delete(key);
  }

  async list<T>(options?: {
    prefix?: string;
    startAfter?: string;
  }): Promise<Map<string, T>> {
    return new Map(
      [...this.values]
        .filter(
          ([key]) =>
            (options?.prefix === undefined || key.startsWith(options.prefix)) &&
            (options?.startAfter === undefined || key > options.startAfter)
        )
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) as [string, T][]
    );
  }

  async transaction<T>(
    body: (tx: DurableObjectKvTransaction) => Promise<T>
  ): Promise<T> {
    const saved = new Map(this.values);
    let result: T;
    try {
      result = await body(this);
    } catch (error) {
      this.values = saved;
      throw error;
    }
    if (this.interruptAfterTransaction) {
      this.interruptAfterTransaction = false;
      throw new Error('stopped after transaction committed');
    }
    return result;
  }
}
