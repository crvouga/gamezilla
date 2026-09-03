export const REPRO_VERSION = 4 as const;

export type Choice = {
  readonly action: string;
  readonly draws: readonly number[];
  readonly args: readonly unknown[];
};

export type ReproMeta = {
  readonly system: string;
  readonly host?: string;
};

export type Repro = {
  readonly version: typeof REPRO_VERSION;
  readonly seed: number | string;
  /** Recorded rng floats from system.generate draws (beyond knobs). */
  readonly system: readonly number[];
  /** Typed system knobs supplied to generate (JSON-projected). */
  readonly knobs: unknown;
  readonly choices: readonly Choice[];
  readonly meta: ReproMeta;
};

export function parseRepro(raw: string | Repro): Repro {
  const obj = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
  if (
    typeof obj !== 'object' ||
    obj === null ||
    !('version' in obj) ||
    (obj as { version: unknown }).version !== REPRO_VERSION
  ) {
    throw new Error(
      `parseRepro: expected Repro v${String(REPRO_VERSION)} (got ${String(
        typeof obj === 'object' && obj !== null && 'version' in obj
          ? (obj as { version: unknown }).version
          : typeof obj
      )})`
    );
  }
  return obj as Repro;
}

export function stringifyRepro(repro: Repro): string {
  return JSON.stringify(repro);
}
