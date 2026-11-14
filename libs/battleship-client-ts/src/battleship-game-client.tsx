import { battleshipGameShared } from '@libs/battleship-shared-ts/battleship-game';
import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { Trans } from '@lingui/solid/macro';
import { battleshipPresentation } from './battleship-presentation';

export const battleshipGameClient = defineGameClient({
  shared: battleshipGameShared,
  title: 'Battleship',
  caption: 'Sink the hidden fleet, play friends or bots',
  tile: 'fleet',
  subtitle: () => (
    <Trans>Hide your fleet. Call your shots. Sink theirs first.</Trans>
  ),
  instructions: [
    {
      key: 'goal',
      title: () => <Trans>Goal</Trans>,
      body: () => (
        <Trans>Sink the other side's whole hidden fleet first.</Trans>
      ),
    },
    {
      key: 'fleet',
      title: () => <Trans>Hide your fleet</Trans>,
      body: () => (
        <Trans>
          Each side hides five ships on its own ten by ten waters: a Carrier of
          five cells, a Battleship of four, a Cruiser of three, a Submarine of
          three and a Destroyer of two. Choose a ship, turn it across or down,
          and press the cell for its bow; ships never overlap or leave the
          board.
        </Trans>
      ),
    },
    {
      key: 'turn',
      title: () => <Trans>Your turn</Trans>,
      body: () => (
        <Trans>
          The Blue fleet fires first, then the sides take turns firing at one
          cell of the other's waters. A miss marks open water and a hit marks
          part of a ship.
        </Trans>
      ),
    },
    {
      key: 'end',
      title: () => <Trans>The end</Trans>,
      body: () => (
        <Trans>
          A ship sinks once every one of its cells is hit. The side that sinks
          the whole fleet wins.
        </Trans>
      ),
    },
  ],
  presentation: battleshipPresentation,
});
