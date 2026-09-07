export type SimMode = 'fast' | 'real';

export type OpenSimOptions = {
  readonly mode?: SimMode;
  /** Committed fixture id under apps/product/fixtures/snapshots/<id>.json */
  readonly snapshot?: string;
};

export function resolveSimMode(options?: OpenSimOptions): SimMode {
  if (options?.mode !== undefined) return options.mode;
  const fromEnv = process.env['SIM_MODE']?.trim();
  // Accept legacy SIM_FIDELITY / SIM_MODE=max
  if (fromEnv === 'real' || fromEnv === 'max') return 'real';
  return 'fast';
}
