import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { heartsGameShared } from '@libs/hearts-shared-ts/hearts-game';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { heartsLesson } from './hearts-lesson';
import { heartsPresentation } from './hearts-presentation';

export const heartsGameClient = defineGameClient({
  shared: heartsGameShared,
  title: 'Hearts',
  caption: 'Avoid hearts and the queen of spades, four players',
  tile: 'cards',
  subtitle: () => <Trans>Duck the tricks. Dodge the queen. Lowest wins.</Trans>,
  lesson: heartsLesson,
  presentation: heartsPresentation,
});
