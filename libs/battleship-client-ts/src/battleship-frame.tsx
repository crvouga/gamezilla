import { sunkShipCells } from '@libs/battleship-shared-ts/battleship-intel';
import {
  BATTLESHIP_PREFIX,
  type BattleshipPosition,
  decodeBattleshipPosition,
  otherSide,
  readBattleshipPosition,
} from '@libs/battleship-shared-ts/battleship-position';
import { t } from '@lingui/core/macro';
import {
  boardOnly,
  fixedPlayers,
  type GameFrame,
  standingsFromWinner,
} from '@pkgs/turn-game-shared-ts/game-frame';
import {
  requireTwoPlayerSide,
  TWO_PLAYER_SIDES,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from 'solid-js';
import { BattleshipBoard } from './battleship-board';
import { shipName } from './battleship-copy';
import { statusText } from './battleship-status';

function battle(position: string): BattleshipPosition {
  return (
    readBattleshipPosition(position) ??
    decodeBattleshipPosition(BATTLESHIP_PREFIX)
  );
}

/** Blue and Red fleets; under each, the ships it has lost. */
export const battleshipFrame: GameFrame<JSX.Element> = {
  players: fixedPlayers(2),
  options: [],
  seats: {
    look: (side) => ({ color: side === 'white' ? 1 : 7 }),
    stat: () => null,
    facts: (position, side) => {
      const incoming =
        battle(position).shots[otherSide(requireTwoPlayerSide(side))];
      return [...sunkShipCells(incoming).keys()].map((ship) => {
        const name = shipName(ship);
        return t`${name} sunk`;
      });
    },
    out: () => false,
  },
  createBoard: boardOnly(BattleshipBoard),
  turnStatus: (position, viewer) => statusText(battle(position), viewer),
  result: (_position, winner) => ({
    scoreLabel: null,
    standings: standingsFromWinner(winner, TWO_PLAYER_SIDES),
  }),
};
