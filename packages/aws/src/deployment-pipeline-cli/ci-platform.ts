export interface CiPlatform {
  error(message: string): void;
  warning(message: string): void;
  notice(message: string): void;
  startGroup(title: string): void;
  endGroup(): void;
  /** Whether the pipeline should enforce that the OIDC deploy role was assumed. */
  readonly enforceDeployRole: boolean;
  /** Append markdown to the CI job summary. No-op when unsupported. */
  appendJobSummary(markdown: string): void;
}

/**
 * Runs `fn` inside a labeled group with elapsed timing.
 * On success the group collapses in GitHub Actions UI; on failure the error
 * is annotated with the step label before re-throwing.
 */
export async function runStep<T>(
  platform: CiPlatform,
  label: string,
  fn: () => T | Promise<T>
): Promise<T> {
  platform.startGroup(label);
  const t0 = performance.now();
  try {
    const result = await fn();
    const ms = performance.now() - t0;
    platform.notice(`${label} — done (${fmtMs(ms)})`);
    return result;
  } catch (e) {
    const ms = performance.now() - t0;
    platform.error(`${label} — FAILED after ${fmtMs(ms)}`);
    throw e;
  } finally {
    platform.endGroup();
  }
}

function fmtMs(ms: number): string {
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  return `${(ms / 1_000).toFixed(1)}s`;
}
