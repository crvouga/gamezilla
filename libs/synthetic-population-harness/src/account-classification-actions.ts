import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { signedInAccountOf } from '@libs/harness/identity';
import { bringToFront } from '@libs/harness/observations';
import { returnToOwnSpace } from '@libs/spaces-harness/space-actions';

export const openSyntheticPopulationGame = scenarioAction({
  name: 'openSyntheticPopulationGame',
  act: async (s, actor: string) => {
    await Promise.resolve(returnToOwnSpace.act(s, actor));
    await Promise.resolve(openMultiplayerChess.act(s, actor));
  },
});

export async function accountAutomationShown(
  s: ProductHarness,
  observer: string,
  subject: string
): Promise<boolean> {
  const accountId = await signedInAccountOf(s, subject);
  if (accountId === null) throw new Error('The participant has no account');
  await bringToFront(s, observer);
  return (await actorUi(s, observer))
    .get(`account-automation-${accountId}`)
    .isVisible();
}
