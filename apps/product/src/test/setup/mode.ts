/**
 * Which system a scenario runs against.
 *
 * - `fast` — everything in this process, virtual time.
 * - `real` — a live browser over loopback HTTP, sidecars booted by the test.
 * - `stack` — a live browser against a separately booted localhost stack
 *   (`bun run stack`): real balancer, real API instances, real provider.
 */
export type SimMode = 'fast' | 'real' | 'stack';

export type OpenSimOptions = {
  readonly mode?: SimMode;
  /** Committed fixture id under apps/product/fixtures/snapshots/<id>.json */
  readonly snapshot?: string;
};

export function resolveSimMode(options?: OpenSimOptions): SimMode {
  if (options?.mode !== undefined) return options.mode;
  const fromEnv = process.env['SIM_MODE']?.trim();
  if (fromEnv === 'stack') return 'stack';
  // Accept legacy SIM_FIDELITY / SIM_MODE=max
  if (fromEnv === 'real' || fromEnv === 'max') return 'real';
  return 'fast';
}

/** Both live-browser modes run on the `bun-webview` host. */
export function isLiveBrowserMode(mode: SimMode): boolean {
  return mode === 'real' || mode === 'stack';
}
