export type OpenSimFidelity = 'sim' | 'max';

export type OpenSimOptions = {
  readonly fidelity?: OpenSimFidelity;
  /** Committed fixture id under sim/test/fixtures/snapshots/<id>.json */
  readonly snapshot?: string;
};

export function resolveOpenSimFidelity(
  options?: OpenSimOptions
): OpenSimFidelity {
  if (options?.fidelity !== undefined) return options.fidelity;
  const fromEnv = process.env['SIM_FIDELITY']?.trim();
  if (fromEnv === 'max') return 'max';
  return 'sim';
}
