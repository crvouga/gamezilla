import type { ProductHostName } from '../../sim/hosts/ports';

/** The product System's three execution profiles, ordered by fidelity. */
export type ProductProfile = ProductHostName;

export type OpenSimOptions = {
  readonly profile?: ProductProfile;
  /** Committed fixture id under apps/product/fixtures/snapshots/<id>.json */
  readonly snapshot?: string;
};

export function resolveProductProfile(
  options?: OpenSimOptions
): ProductProfile {
  if (options?.profile !== undefined) return options.profile;
  const value = process.env['SIM_PROFILE']?.trim();
  if (value === undefined || value === '') return 'in-process';
  if (
    value === 'in-process' ||
    value === 'localhost:mocked' ||
    value === 'localhost'
  ) {
    return value;
  }
  throw new Error(`invalid SIM_PROFILE: ${value}`);
}
