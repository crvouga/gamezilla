import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { multiplayerText } from '@libs/game-matchmaking-harness/multiplayer-reads';
import {
  readCustomGameAlert,
  readCustomGameScreenText,
} from '@libs/game-session-harness/custom-game-reads';
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

/**
 * What the person's chess screen tells them: a Custom Game's refusal alert,
 * else multiplayer chess's search status.
 */
export async function readChessToldText(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  return (
    (await readCustomGameAlert(s, actor)) ??
    (await multiplayerText(s, actor, 'multiplayer-waiting'))
  );
}
