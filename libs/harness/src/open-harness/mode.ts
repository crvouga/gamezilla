/**
 * Which system a scenario runs against.
 *
 * - `fast` — everything in this process, virtual time.
 * - `real` — a live browser over loopback HTTP, sidecars booted by the test.
 * - `stack` — a live browser against a separately booted localhost stack
 *   (`bun run dev`): real balancer, real API instances, real provider.
 */
export type HarnessMode = 'fast' | 'real' | 'stack';

export type OpenHarnessOptions = {
  readonly mode?: HarnessMode;
  /** Committed fixture id under <package>/fixtures/snapshots/<id>.json */
  readonly snapshot?: string;
  /**
   * The run's seed (default `1`). A suite that walks several independent
   * random paths through one composition gives each its own.
   */
  readonly seed?: number;
  /**
   * How the report names this run, when the caller knows better than the
   * stack does (a Gherkin scenario, a Quint trace): its title and the spec
   * file and line it comes from.
   */
  readonly report?: {
    readonly title: string;
    readonly sourceFile: string;
    readonly sourceLine?: number;
  };
};

export function resolveHarnessMode(options?: OpenHarnessOptions): HarnessMode {
  if (options?.mode !== undefined) return options.mode;
  const fromEnv = process.env['HARNESS_MODE']?.trim();
  if (fromEnv === 'stack') return 'stack';
  // Accept legacy HARNESS_FIDELITY / HARNESS_MODE=max
  if (fromEnv === 'real' || fromEnv === 'max') return 'real';
  return 'fast';
}

/** Both live-browser modes run on the `bun-webview` host. */
export function isLiveBrowserMode(mode: HarnessMode): boolean {
  return mode === 'real' || mode === 'stack';
}
