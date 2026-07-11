import type { WriteDefinition } from './define-write';

export type WriteRegistry = {
  get(name: string): WriteDefinition<unknown, unknown> | undefined;
};

export function createWriteRegistry(
  writes: readonly WriteDefinition<unknown, unknown>[]
): WriteRegistry {
  const byName = new Map<string, WriteDefinition<unknown, unknown>>();
  for (const write of writes) {
    byName.set(write.name, write);
  }
  return {
    get: (name) => byName.get(name),
  };
}

export function mergeWriteRegistries(
  ...registries: readonly WriteRegistry[]
): WriteRegistry {
  return {
    get: (name) => {
      for (const registry of registries) {
        const write = registry.get(name);
        if (write !== undefined) {
          return write;
        }
      }
      return undefined;
    },
  };
}
