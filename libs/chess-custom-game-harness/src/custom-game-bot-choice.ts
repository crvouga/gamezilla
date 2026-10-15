import { TURN_GAMES } from '@libs/game-catalog-shared/turn-games';
import { customGameLegalMoves } from '@libs/game-session-shared/custom-game-position';
import { scenarioAction } from '@libs/harness/actor-ui';
import type {
  HarnessComposition,
  HarnessRoomNode,
} from '@libs/harness/composition';
import { readCustomGameProbe } from './custom-game-ui';

const choices = new WeakMap<HarnessRoomNode, { next: number | null }>();

/** Inject a documented allowed legal choice through the room's random port. */
export function customGameBotRoomNode(
  createNode: NonNullable<HarnessComposition['roomNode']>
): NonNullable<HarnessComposition['roomNode']> {
  return (env, gateway) => {
    const choice = { next: null as number | null };
    const random = (): number => {
      const next = choice.next;
      choice.next = null;
      return next ?? env.random();
    };
    const node = Object.assign(createNode({ ...env, random }, gateway), {
      clientRandom: random,
    });
    choices.set(node, choice);
    return node;
  };
}

export const chooseCustomGameBotMove = scenarioAction({
  name: 'chooseCustomGameBotMove',
  act: async (s, observer: string, uci: string) => {
    const game = (await readCustomGameProbe(s, observer))?.current;
    if (game === null || game === undefined)
      throw new Error('No Custom Game to follow');
    const moves = customGameLegalMoves(game, TURN_GAMES);
    const index = moves.indexOf(uci);
    if (index === -1) throw new Error(`${uci} is not a legal bot choice`);
    const choice = choices.get(s.harness.roomNode);
    if (choice === undefined)
      throw new Error('Room random choice was not injected');
    choice.next = (index + 0.5) / moves.length;
  },
});
