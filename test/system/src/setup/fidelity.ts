export type OpenSimFidelity = 'sim' | 'max';

export type OpenSimOptions = {
  readonly fidelity?: OpenSimFidelity;
};

export function resolveOpenSimFidelity(
  options?: OpenSimOptions
): OpenSimFidelity {
  if (options?.fidelity !== undefined) return options.fidelity;
  const fromEnv = process.env['SYSTEM_FIDELITY']?.trim();
  if (fromEnv === 'max') return 'max';
  return 'sim';
}

/** World mesh (partition / dual-mount) is sim-only. */
export function isWorldMeshSupported(fidelity: OpenSimFidelity): boolean {
  return fidelity === 'sim';
}
