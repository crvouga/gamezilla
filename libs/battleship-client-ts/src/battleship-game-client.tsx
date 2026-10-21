import { battleshipGameShared } from '@libs/battleship-shared-ts/battleship-game';
import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { Trans } from '@lingui/solid/macro';
import { battleshipPresentation } from './battleship-presentation';

export const battleshipGameClient = defineGameClient({
  shared: battleshipGameShared,
  title: 'Battleship',
  caption: 'Sink the hidden fleet, play friends or bots',
  subtitle: () => (
    <Trans>Hide your fleet. Call your shots. Sink theirs first.</Trans>
  ),
  instructions: () => (
    <Trans>
      Each side hides five ships on its own ten by ten waters: a Carrier of five
      cells, a Battleship of four, a Cruiser of three, a Submarine of three and
      a Destroyer of two. Choose a ship, turn it across or down, and press the
      cell for its bow; ships never overlap or leave the board. Then the Blue
      fleet fires first and the sides take turns firing at one cell of the
      other's waters. A miss marks open water, a hit marks part of a ship, and a
      ship sinks once every one of its cells is hit. Sink the whole hidden fleet
      first to win.
    </Trans>
  ),
  presentation: battleshipPresentation,
});
