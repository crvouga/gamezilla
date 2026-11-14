import { connectFourGameShared } from '@libs/connect-four-shared-ts/connect-four-game';
import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { Trans } from '@lingui/solid/macro';
import { connectFourPresentation } from './connect-four-presentation';

export const connectFourGameClient = defineGameClient({
  shared: connectFourGameShared,
  title: 'Connect Four',
  caption: 'Connect four discs, play friends or bots',
  tile: 'discs',
  subtitle: () => (
    <Trans>Drop a disc. Connect four. Plan your next turn.</Trans>
  ),
  instructions: [
    {
      key: 'goal',
      title: () => <Trans>Goal</Trans>,
      body: () => (
        <Trans>
          Line up four of your own: in a row, a column or a diagonal.
        </Trans>
      ),
    },
    {
      key: 'turn',
      title: () => <Trans>Your turn</Trans>,
      body: () => (
        <Trans>
          Red circles play first, then Yellow diamonds. Choose a column; your
          piece drops into its lowest empty place.
        </Trans>
      ),
    },
    {
      key: 'end',
      title: () => <Trans>The end</Trans>,
      body: () => (
        <Trans>Four in a line wins. A full board without four is a draw.</Trans>
      ),
    },
  ],
  presentation: connectFourPresentation,
});
