import type { ProductHarness } from '@libs/harness/system/harness';
import { CustomGamesAttr } from '../public/custom-game';

/** The acknowledged game record, also retained when its space has ended. */
export function readStoredCustomGames(s: ProductHarness, spaceId: string) {
  const state = s.harness.roomNode.inspect(`space:${spaceId}`)?.committedState;
  if (state === undefined)
    throw new Error(`no acknowledged room for ${spaceId}`);
  return CustomGamesAttr.from(state);
}
