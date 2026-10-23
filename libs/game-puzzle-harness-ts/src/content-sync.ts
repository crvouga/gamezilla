import { waitUntil } from '@pkgs/sync-engine-harness-ts/wait-until';
import type { ContentHarness } from './content-system';

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
