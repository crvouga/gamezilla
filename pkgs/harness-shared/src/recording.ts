export const RECORDING_VERSION = 6 as const;

export type Step = {
  readonly action: string;
  readonly args: readonly unknown[];
};

export type RecordingMeta = {
  readonly system: string;
  readonly runtime?: string;
};

export type Recording = {
  readonly version: typeof RECORDING_VERSION;
  readonly seed: number | string;
  /** Typed system args supplied to create (JSON-projected). */
  readonly args: unknown;
  readonly steps: readonly Step[];
  readonly meta: RecordingMeta;
};

export function parseRecording(raw: string | Recording): Recording {
  const obj = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
  if (
    typeof obj !== 'object' ||
    obj === null ||
    !('version' in obj) ||
    (obj as { version: unknown }).version !== RECORDING_VERSION
  ) {
    throw new Error(
      `parseRecording: expected Recording v${String(RECORDING_VERSION)} (got ${String(
        typeof obj === 'object' && obj !== null && 'version' in obj
          ? (obj as { version: unknown }).version
          : typeof obj
      )})`
    );
  }
  return obj as Recording;
}

export function stringifyRecording(repro: Recording): string {
  return JSON.stringify(repro);
}
