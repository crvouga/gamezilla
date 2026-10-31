import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { initialSokobanDefinition } from '@libs/sokoban-shared-ts/sokoban-board-edits';
import { sokobanGameShared } from '@libs/sokoban-shared-ts/sokoban-game';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { P } from '@pkgs/ui-root-client-ts/text';
import { SokobanEditor } from './sokoban-editor';
import { SokobanPlayer, SokobanPreview } from './sokoban-player';

export const sokobanGameClient = defineGameClient({
  shared: sokobanGameShared,
  title: 'Sokoban',
  caption: 'Push every crate onto a goal',
  subtitle: () => <Trans>Push every crate onto a goal, one at a time.</Trans>,
  instructions: () => (
    <P>
      <Trans>
        Move the worker up, down, left or right. Walk onto empty floor or push
        one crate a square further onto empty floor. Crates are never pulled,
        and two crates in a row do not move. Finish when every crate stands on a
        goal.
      </Trans>
    </P>
  ),
  puzzleContent: {
    Player: SokobanPlayer,
    Preview: SokobanPreview,
    frame: {
      stats: { moves: () => t`Moves`, pushes: () => t`Pushes` },
      turnStatus: () => null,
    },
    authoring: {
      Editor: SokobanEditor,
      initialDefinition: initialSokobanDefinition,
    },
  },
});
