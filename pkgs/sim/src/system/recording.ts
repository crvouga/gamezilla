export const REPRO_VERSION = 6 as const;

export type Choice = {
  readonly action: string;
  readonly args: readonly unknown[];
};

export type ReproMeta = {
  readonly system: string;
  readonly host?: string;
};

export type Repro = {
  readonly version: typeof REPRO_VERSION;
  readonly seed: number | string;
  /** Typed system args supplied to create (JSON-projected). */
  readonly args: unknown;
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
