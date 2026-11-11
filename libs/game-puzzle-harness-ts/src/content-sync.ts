import { waitUntil } from '@pkgs/sync-engine-harness-ts/wait-until';
import type { ContentHarness } from './content-system';

/** `waitForContent` over what a mounted screen shows now, for the place helpers. */
export function contentWait(
  s: ContentHarness
): (ready: () => boolean) => Promise<void> {
  return (ready) => waitForContent(s, () => Promise.resolve(ready()));
}

export async function waitForContent(
  s: ContentHarness,
  predicate: () => Promise<boolean>
): Promise<void> {
  await waitUntil(
    {
      seed: s.seed,
      scheduler: s.session.scheduler.underlying,
      network: s.session.network,
    },
    predicate
  );
}
