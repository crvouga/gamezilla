import { openFindingAnOpponentIfAny } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import {
  readGameSessionAlert,
  readGameSessionScreenText,
} from '@libs/game-session-harness-ts/game-session-reads';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { CHESS_GAME_ID } from './chess-playable';

/**
 * Bring the chess screen a person was told something on into view: the
 * Game Session they are looking at, otherwise multiplayer chess.
 */
export const focusChessScreen = scenarioAction({
  name: 'focusChessScreen',
  act: async (s, actor: string) => {
    if ((await readGameSessionScreenText(s, actor)) !== null) return;
    await Promise.resolve(
      openFindingAnOpponentIfAny.act(s, actor, CHESS_GAME_ID)
    );
  },
});

/**
 * What the person's chess screen tells them: a Game Session's refusal alert,
 * else multiplayer chess's search status.
 */
export async function readChessToldText(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const alert = await readGameSessionAlert(s, actor);
  if (alert !== null) return alert;
  const waiting = (await actorUi(s, actor)).get('multiplayer-waiting');
  return (await waiting.isVisible()) ? await waiting.text() : null;
}
