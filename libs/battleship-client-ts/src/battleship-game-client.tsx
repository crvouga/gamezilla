import { battleshipGameShared } from '@libs/battleship-shared-ts/battleship-game';
import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { battleshipLesson } from './battleship-lesson';
import { battleshipPresentation } from './battleship-presentation';

export const battleshipGameClient = defineGameClient({
  shared: battleshipGameShared,
  title: 'Battleship',
  caption: 'Sink the hidden fleet, play friends or bots',
  tile: 'fleet',
  subtitle: () => (
    <Trans>Hide your fleet. Call your shots. Sink theirs first.</Trans>
  ),
  lesson: battleshipLesson,
  presentation: battleshipPresentation,
});
