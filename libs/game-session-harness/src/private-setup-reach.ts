/**
 * Which private setups reach a person, read where they leave the platform
 * (`private-setup-observation`): a person's screen draws only what reaches
 * their device, so a setup that never reaches it is one they cannot see.
 */

import { multiplayerSpaceId } from '@libs/game-matchmaking-harness/multiplayer-spaces';
import type { ProductHarness } from '@libs/harness/harness';
import { deviceRowsOf, roomHistorySentTo } from './private-setup-observation';

/**
 * Which of `setups` reach `actor`: in what the room of the space their
 * device is in sends them from the start, or among their device's rows.
 */
export async function privateSetupsReaching(
  s: ProductHarness,
  actor: string,
  setups: readonly string[]
): Promise<readonly string[]> {
  const spaceId = await multiplayerSpaceId(s, actor);
  const sent =
    spaceId === null ? '' : await roomHistorySentTo(s, actor, spaceId);
  const rows = await deviceRowsOf(s, actor);
  return setups.filter((setup) => sent.includes(setup) || rows.includes(setup));
}
