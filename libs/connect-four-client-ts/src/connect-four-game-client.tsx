import { connectFourGameShared } from '@libs/connect-four-shared-ts/connect-four-game';
import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { connectFourLesson } from './connect-four-lesson';
import { connectFourPresentation } from './connect-four-presentation';

export const connectFourGameClient = defineGameClient({
  shared: connectFourGameShared,
  title: 'Connect Four',
  caption: 'Connect four discs, play friends or bots',
  tile: 'discs',
  subtitle: () => (
    <Trans>Drop a disc. Connect four. Plan your next turn.</Trans>
  ),
  lesson: connectFourLesson,
  presentation: connectFourPresentation,
});
