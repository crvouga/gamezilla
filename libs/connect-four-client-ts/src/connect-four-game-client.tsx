import { connectFourGameShared } from '@libs/connect-four-shared-ts/connect-four-game';
import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { Trans } from '@lingui/solid/macro';
import { connectFourPresentation } from './connect-four-presentation';

export const connectFourGameClient = defineGameClient({
  shared: connectFourGameShared,
  title: 'Connect Four',
  caption: 'Connect four discs, play friends or bots',
  subtitle: () => (
    <Trans>Drop a disc. Connect four. Plan your next turn.</Trans>
  ),
  instructions: () => (
    <Trans>
      Red circles play first, then Yellow diamonds. Choose a column to drop into
      its lowest empty place. Four in a row, column, or diagonal wins. A full
      board without four is a draw.
    </Trans>
  ),
  presentation: connectFourPresentation,
});
