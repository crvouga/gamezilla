import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { bringToFront } from '@libs/harness-ts/observations';
import { openSyntheticGame } from './synthetic-game-actions';

export const openSyntheticPopulationGame = scenarioAction({
  name: 'openSyntheticPopulationGame',
  act: async (s, actor: string, game: string) => {
    await Promise.resolve(openSyntheticGame.act(s, actor, game));
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
