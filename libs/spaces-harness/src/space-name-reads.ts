import type { ProductHarness } from '@libs/harness/harness';

import { spaceTitleShown } from './spaces-ui-reads';

/**
 * The actor's open space shows it named after its host by `hostName` — the
 * host's name as everyone sees it (their username or their stand-in name).
 */
export async function spaceNamedAfterShown(
  s: ProductHarness,
  actorId: string,
  hostName: string
): Promise<boolean> {
  return (await spaceTitleShown(s, actorId)) === `${hostName}'s space`;
}
