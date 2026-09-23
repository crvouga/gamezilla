import type { ProductHostName } from '../../sim/hosts/ports';
import { product } from '../../sim/system/system';

/** The product System's three execution profiles, ordered by fidelity. */
export type ProductProfile = ProductHostName;

export type OpenSimOptions = {
  /** Pin one run to a profile; otherwise the harness-selected one runs. */
  readonly profile?: ProductProfile;
  /** Committed fixture id under apps/product/fixtures/snapshots/<id>.json */
  readonly snapshot?: string;
};

/**
 * Harness fabric pick: `SIM_PROFILE` selects the product runtime for every
 * run that names none (`openSim`, `product.explore`, `product.replay`), so
 * the same scenarios run in-process or against the full stack (`bun e2e`).
 */
export function applyProductProfileFromEnv(): void {
  const value = process.env['SIM_PROFILE']?.trim();
  if (value === undefined || value === '') return;
  product.useRuntime(value);
}
