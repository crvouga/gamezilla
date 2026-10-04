import type {
  HarnessComposition,
  HarnessRoomNode,
} from '@libs/harness/composition';
import { scenarioAction } from '@libs/harness/actor-ui';
import { customGameLegalMoves } from '@libs/chess-custom-game-shared/custom-game-position';
import { readCustomGameProbe } from './custom-game-ui';

const choices = new WeakMap<HarnessRoomNode, { next: number | null }>();

/** Inject a documented allowed legal choice through the room's random port. */
export function customGameBotRoomNode(
  createNode: NonNullable<HarnessComposition['roomNode']>
): NonNullable<HarnessComposition['roomNode']> {
  return (env, gateway) => {
    const choice = { next: null as number | null };
    const node = createNode(
      {
        ...env,
        random: () => {
          const next = choice.next;
          choice.next = null;
          return next ?? env.random();
        },
      },
      gateway
    );
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
    const moves = customGameLegalMoves(game);
    const index = moves.indexOf(uci);
    if (index === -1) throw new Error(`${uci} is not a legal bot choice`);
    const choice = choices.get(s.harness.roomNode);
    if (choice === undefined)
      throw new Error('Room random choice was not injected');
    choice.next = (index + 0.5) / moves.length;
  },
});
