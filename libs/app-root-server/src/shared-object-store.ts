import { ObjectStoreWithPrefix } from '@pkgs/object-store-root-shared/impl-with-prefix';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';

const PREFIX = 'shared/';

/** Mount shared reference data without changing environment-owned storage. */
export class SharedObjectStore implements ObjectStore {
  constructor(
    private readonly environment: ObjectStore,
    private readonly shared: ObjectStore | null
  ) {}

  private target(key: string): { store: ObjectStore; key: string } {
    if (!key.startsWith(PREFIX)) return { store: this.environment, key };
    if (this.shared === null)
      throw new Error(
        'Shared data storage is not configured. Refresh the development secrets after the fleet infrastructure is applied.'
      );
    return { store: this.shared, key: key.slice(PREFIX.length) };
  }

  get(key: string) {
    const target = this.target(key);
    return target.store.get(target.key);
  }
  head(key: string) {
    const target = this.target(key);
    return target.store.head(target.key);
  }
  put(key: string, bytes: Uint8Array, contentType: string) {
    const target = this.target(key);
    return target.store.put(target.key, bytes, contentType);
  }
  delete(key: string) {
    const target = this.target(key);
    return target.store.delete(target.key);
  }
  getUri(key: string) {
    const target = this.target(key);
    return target.store.getUri(target.key);
  }

  async deleteMany(keys: readonly string[]) {
    const shared = keys.filter((key) => key.startsWith(PREFIX));
    if (shared.length > 0) {
      const target = this.target(shared[0]!);
      await target.store.deleteMany(
        shared.map((key) => key.slice(PREFIX.length))
      );
    }
    await this.environment.deleteMany(
      keys.filter((key) => !key.startsWith(PREFIX))
    );
  }

  async listKeys(prefix = ''): Promise<readonly string[]> {
    if (prefix.startsWith(PREFIX)) {
      const target = this.target(prefix);
      return (await target.store.listKeys(target.key)).map(
        (key) => `${PREFIX}${key}`
      );
    }
    const environment = await this.environment.listKeys(prefix);
    const shared =
      this.shared && PREFIX.startsWith(prefix)
        ? (await this.shared.listKeys()).map((key) => `${PREFIX}${key}`)
        : [];
    return [
      ...environment.filter((key) => !key.startsWith(PREFIX)),
      ...shared,
    ].sort();
  }

  withPrefix(prefix: string): ObjectStore {
    return new ObjectStoreWithPrefix(this, prefix);
  }
}
