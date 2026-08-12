import type { DevMenuItem, DevMenuPort } from './ports';

export type InMemoryDevMenuPort = DevMenuPort & {
  readonly registeredItems: () => readonly DevMenuItem[];
};

/** Sim / test {@link DevMenuPort} that captures registered items. */
export function createInMemoryDevMenuPort(): InMemoryDevMenuPort {
  let items: DevMenuItem[] = [];
  return {
    async registerItems(next) {
      items = [...next];
    },
    registeredItems() {
      return items;
    },
  };
}
