import { pollUntil } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import type { SyntheticUserApplication } from '@libs/synthetic-population-behavior-shared-ts/synthetic-user-application';
import type { ApplicationEvent } from '@libs/synthetic-population-shared-ts/application-events';
import {
  liveSyntheticUsers,
  syntheticApplication,
} from './live-synthetic-users';
import { recordMovesSeen } from './moves-seen';
import { syntheticGameView } from './synthetic-game-actions';
import { cedarUser } from './synthetic-user-fixtures';

/**
 * Continues only the current match, Cedar's and any other Synthetic User's
 * in it (each as its persona plays); administrative pause never abandons it.
 */
export async function playSyntheticCurrentGame(
  s: ProductHarness,
  emit: (event: ApplicationEvent) => void
): Promise<void> {
  const cedar = await cedarUser(s);
  const others = (await liveSyntheticUsers(s)).filter(
    (member) => member.actor !== 'cedar'
  );
  const players: { actor: string; app: SyntheticUserApplication }[] = [
    {
      actor: 'cedar',
      app: await syntheticApplication(
        s,
        { actor: 'cedar', userId: cedar.id },
        emit
      ),
    },
  ];
  for (const member of others)
    players.push({
      actor: member.actor,
      app: await syntheticApplication(s, member),
    });
  const play = async () => {
    for (const player of players) {
      await bringToFront(s, player.actor);
      await player.app.continueCurrentGame();
    }
    await recordMovesSeen(s);
    await bringToFront(s, 'cedar');
  };
  try {
    await recordMovesSeen(s);
    await bringToFront(s, 'cedar');
    await players[0]!.app.continueCurrentGame();
    if (await s.actors.get('cedar')!.ui.get('multiplayer-offline').isVisible())
      return;
    await pollUntil(
      s,
      async () => {
        await play();
        const game = await syntheticGameView(s);
        return game.outcome !== null && game.outcome !== 'ongoing'
          ? game
          : null;
      },
      {
        maxMs: 180_000,
        description: 'Cedar continues the current game to its result',
      }
    );
  } finally {
    for (const player of players) player.app.close();
  }
}
