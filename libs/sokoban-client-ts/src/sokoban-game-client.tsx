import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { initialSokobanDefinition } from '@libs/sokoban-shared-ts/sokoban-board-edits';
import { sokobanGameShared } from '@libs/sokoban-shared-ts/sokoban-game';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { SokobanEditor } from './sokoban-editor';
import { SokobanPlayer, SokobanPreview } from './sokoban-player';

export const sokobanGameClient = defineGameClient({
  shared: sokobanGameShared,
  title: 'Sokoban',
  caption: 'Push every crate onto a goal',
  tile: 'crates',
  subtitle: () => <Trans>Push every crate onto a goal, one at a time.</Trans>,
  instructions: [
    {
      key: 'goal',
      title: () => <Trans>Goal</Trans>,
      body: () => <Trans>Finish when every crate stands on a goal.</Trans>,
    },
    {
      key: 'move',
      title: () => <Trans>Move</Trans>,
      body: () => (
        <Trans>
          Move the worker up, down, left or right, onto empty floor.
        </Trans>
      ),
    },
    {
      key: 'push',
      title: () => <Trans>Push</Trans>,
      body: () => (
        <Trans>
          Walk into a crate to push it one square further onto empty floor.
          Crates are never pulled, and two crates in a row do not move.
        </Trans>
      ),
    },
  ],
  puzzleContent: {
    Player: SokobanPlayer,
    Preview: SokobanPreview,
    frame: {
      stats: { moves: () => t`Moves`, pushes: () => t`Pushes` },
      turnStatus: () => null,
      // A board stops at its largest tiles; on one column it sits centred
      // rather than leaving a strip beside it.
      stageAlign: 'center',
    },
    authoring: {
      Editor: SokobanEditor,
      initialDefinition: initialSokobanDefinition,
      // A draft that cannot be played (unreadable, or still needing a
      // worker, crates or goals) cannot be playtested.
      readable: (definition) =>
        sokobanGameShared.puzzleContent.rules.validateDefinition(definition)
          .valid,
    },
  },
});
