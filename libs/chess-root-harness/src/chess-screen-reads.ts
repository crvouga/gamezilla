import { readCustomGameScreenText } from '@libs/chess-custom-game-harness/custom-game-play-reads';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { multiplayerText } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';

/**
 * Bring the chess screen a person was told something on into view: the
 * Custom Game they are looking at, otherwise multiplayer chess.
 */
export const focusChessScreen = scenarioAction({
  name: 'focusChessScreen',
  act: async (s, actor: string) => {
    if ((await readCustomGameScreenText(s, actor)) !== null) return;
    await Promise.resolve(openMultiplayerChess.act(s, actor));
  },
});

/** What the person's chess screen says: a Custom Game, else multiplayer chess. */
export async function readChessScreenText(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  return (
    (await readCustomGameScreenText(s, actor)) ??
    (await multiplayerText(s, actor, 'multiplayer-waiting'))
  );
}
