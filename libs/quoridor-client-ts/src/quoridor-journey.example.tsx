import {
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import {
  decodeQuoridor,
  encodeQuoridor,
  playQuoridor,
} from '@libs/quoridor-shared-ts/quoridor';
import { createSignal, type JSX, mergeProps } from 'solid-js';

type Table = Parameters<typeof renderGameTable>;

/**
 * A journey through the production rules. Position, turn, moves and ending
 * update in place, as a live table does, instead of rebuilding the table
 * after every move. `seat: 'turn'` passes the device to whoever moves next;
 * `'fixed'` keeps the story's own seat and board orientation.
 */
export function quoridorJourney(journey: {
  readonly presentation: Table[0];
  readonly sides: Table[1];
  readonly reason: string;
  readonly seat: 'turn' | 'fixed';
}): (args: Table[2], context: Table[3]) => JSX.Element {
  return (args, context) => renderJourney(journey, args, context);
}

function renderJourney(
  journey: Parameters<typeof quoridorJourney>[0],
  args: Table[2],
  context: Table[3]
): JSX.Element {
  const { sides } = journey;
  const [game, setGame] = createSignal(decodeQuoridor(args.position));
  const sideOf = (player: number) => {
    const side = sides[player];
    if (side === undefined) throw new Error(`Unknown Quoridor seat ${player}`);
    return side;
  };
  const board = mergeProps(args, {
    get position() {
      return encodeQuoridor(game());
    },
    get orientation() {
      return journey.seat === 'turn' ? sideOf(game().turn) : args.orientation;
    },
    get interactive() {
      return args.interactive && game().winner === null;
    },
    onAction(action: string) {
      args.onAction(action);
      const next = playQuoridor(game(), action);
      if (next === null)
        throw new Error(`Refused ${game().mode} action: ${action}`);
      setGame(next);
    },
  });
  const story = (context.parameters['table'] ?? {}) as GameTableStory;
  const table: GameTableStory = mergeProps(story, {
    get turn() {
      return sideOf(game().turn);
    },
    get moves() {
      return game().actions;
    },
    get ending() {
      const winner = game().winner;
      return winner === null
        ? undefined
        : { winner: sideOf(winner), reason: journey.reason };
    },
  });
  return renderGameTable(journey.presentation, sides, board, {
    ...context,
    parameters: { ...context.parameters, table },
  });
}
