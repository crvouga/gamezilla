import type { Driver } from '../driver/driver';

/** Fingerprinted interactive target for explore walks. */
export type InventoryItem = {
  readonly testId: string;
  readonly role?: string;
  readonly accessibleName?: string;
  readonly text?: string;
  readonly structuralPath: string;
};

export type Inventory = {
  readonly pressables: readonly InventoryItem[];
  readonly inputs: readonly InventoryItem[];
  readonly canGoBack: boolean;
  readonly screen: string | null;
  readonly errors: readonly string[];
};

/**
 * Optional explore capability on a Driver. Concrete drivers that can enumerate
 * the UI implement this; others leave it undefined and explore actions disable.
 */
export type InventoryCapable = {
  readonly inventory: () => Promise<Inventory>;
};

export function hasInventory(
  driver: Driver
): driver is Driver & InventoryCapable {
  return (
    'inventory' in driver &&
    typeof (driver as InventoryCapable).inventory === 'function'
  );
}

/** Empty inventory for drivers that cannot enumerate. */
export const EMPTY_INVENTORY: Inventory = {
  pressables: [],
  inputs: [],
  canGoBack: false,
  screen: null,
  errors: [],
};
