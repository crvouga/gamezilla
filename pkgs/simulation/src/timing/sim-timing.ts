/**
 * Lightweight wall-clock phase timing for simulation harness diagnostics.
 *
 * Summary always prints on `finish()`. Per-phase lines only when `SIM_TIMING=1`.
 * Callers inject `now` (e.g. wall clock at a test composition root).
 */

export type SimTiming = {
  /** Record elapsed ms for a named phase (overwrites prior value for the name). */
  mark(name: string, elapsedMs: number): void;
  /** Time an async function and record under `name`. */
  time<T>(name: string, run: () => Promise<T>): Promise<T>;
  /** Print one-line summary; no-op if already finished. */
  finish(label?: string): void;
};

export function createSimTiming(args: {
  readonly now: () => number;
}): SimTiming {
  const phases = new Map<string, number>();
  let finished = false;
  const verbose = process.env['SIM_TIMING'] === '1';

  return {
    mark(name, elapsedMs) {
      phases.set(name, Math.max(0, Math.round(elapsedMs)));
      if (verbose) {
        process.stdout.write(
          `[sim-timing] ${name}=${Math.round(elapsedMs)}ms\n`
        );
      }
    },
    async time(name, run) {
      const start = args.now();
      try {
        return await run();
      } finally {
        this.mark(name, args.now() - start);
      }
    },
    finish(label = 'sim') {
      if (finished) return;
      finished = true;
      let total = 0;
      const parts: string[] = [];
      for (const [name, ms] of phases) {
        parts.push(`${name}=${ms}`);
        total += ms;
      }
      process.stdout.write(
        `[sim-timing] ${label} ${parts.join(' ')}${parts.length > 0 ? ' ' : ''}total=${total}\n`
      );
    },
  };
}
