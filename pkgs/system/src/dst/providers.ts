/**
 * Generic leaf provider for DST worlds. Wrap real `@pkgs/*` adapters — do not
 * invent parallel port types here.
 */

export type ProviderSpec<T = unknown> = {
  create(address: string): T | Promise<T>;
  corrupt?(address: string): void | Promise<void>;
  wipe?(address: string): void | Promise<void>;
};

export type DecoratePortHooks<T> = {
  corrupt?(instance: T, address: string): void | Promise<void>;
  wipe?(instance: T, address: string): void | Promise<void>;
};

/**
 * Build a {@link ProviderSpec} from a real adapter factory plus optional
 * corrupt/wipe hooks that mutate that adapter in place.
 */
export function decoratePort<T>(
  create: (address: string) => T | Promise<T>,
  hooks?: DecoratePortHooks<T>
): ProviderSpec<T> {
  const instances = new Map<string, T>();
  return {
    async create(address) {
      const existing = instances.get(address);
      if (existing !== undefined) return existing;
      const live = await create(address);
      instances.set(address, live);
      return live;
    },
    async corrupt(address) {
      const live = instances.get(address);
      if (live === undefined || !hooks?.corrupt) return;
      await hooks.corrupt(live, address);
    },
    async wipe(address) {
      const live = instances.get(address);
      if (live === undefined) return;
      if (hooks?.wipe) {
        await hooks.wipe(live, address);
        return;
      }
      instances.delete(address);
    },
  };
}

/** Constant leaf (payments, LLM stubs, …). */
export function stubPort<T extends object>(value: T): ProviderSpec<T> {
  return decoratePort(async () => value);
}
