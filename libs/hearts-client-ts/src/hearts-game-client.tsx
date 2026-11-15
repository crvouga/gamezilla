import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { heartsGameShared } from '@libs/hearts-shared-ts/hearts-game';
import { Trans } from '@lingui/solid/macro';
import { heartsPresentation } from './hearts-presentation';

export const heartsGameClient = defineGameClient({
  shared: heartsGameShared,
  title: 'Hearts',
  caption: 'Avoid hearts and the queen of spades, four players',
  tile: 'cards',
  subtitle: () => <Trans>Duck the tricks. Dodge the queen. Lowest wins.</Trans>,
  instructions: [
    {
      key: 'goal',
      title: () => <Trans>Goal</Trans>,
      body: () => (
        <Trans>
          Take as few points as you can. Each heart you take costs a point and
          the queen of spades thirteen.
        </Trans>
      ),
    },
    {
      key: 'pass',
      title: () => <Trans>Pass three cards</Trans>,
      body: () => (
        <Trans>
          Four players each get thirteen cards. Before each deal's play,
          everyone secretly passes three cards: to the left, then right, then
          across, then not at all, and again.
        </Trans>
      ),
    },
    {
      key: 'trick',
      title: () => <Trans>Play the tricks</Trans>,
      body: () => (
        <Trans>
          A trick is one card from each player, in turn. The first card played
          leads, and its suit is the suit led.
        </Trans>
      ),
      points: [
        () => (
          <Trans>Whoever holds the two of clubs leads the first trick.</Trans>
        ),
        () => <Trans>Follow the suit led if you can.</Trans>,
        () => (
          <Trans>
            The highest card of the suit led takes the trick and leads the next.
          </Trans>
        ),
        () => (
          <Trans>
            For example: clubs are led 2, 9, king, then a heart from someone
            with no clubs. The king takes the trick, heart and all.
          </Trans>
        ),
      ],
    },
    {
      key: 'holding',
      title: () => <Trans>Holding back hearts and the queen</Trans>,
      body: () => (
        <Trans>
          Hearts and the queen of spades can't be played on the first trick
          unless you hold nothing else. Hearts can't be led until one has been
          played, unless you hold only hearts.
        </Trans>
      ),
    },
    {
      key: 'end',
      title: () => <Trans>Scoring and the end</Trans>,
      body: () => (
        <Trans>
          Take every heart and the queen and everyone else gets twenty-six
          instead. When a score reaches 100 at the end of a deal, the lowest
          score wins; tied lowest scores share the win.
        </Trans>
      ),
    },
  ],
  presentation: heartsPresentation,
});
