/**
 * `HARNESS_MODE=real` sidecars (embedded Postgres, Mockingbird S3, EMQX) are booted by the
 * app that owns them — the harness is a shell and may not import an app. The
 * app registers its booter from a `bun test` preload; every product system's
 * `bun-webview` host calls it, so any suite runs against a live browser.
 */

type RealStackBooter = () => Promise<void>;

let booter: RealStackBooter | null = null;

export function registerRealStackBooter(boot: RealStackBooter): void {
  booter = boot;
}

export async function ensureRealStack(): Promise<void> {
  if (booter === null) {
    throw new Error(
      'HARNESS_MODE=real: no real-stack booter registered — run through `bun run --filter @apps/product test:max`, which preloads it'
    );
  }
  await booter();
}
