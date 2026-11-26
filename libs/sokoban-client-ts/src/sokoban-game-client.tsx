import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { initialSokobanDefinition } from '@libs/sokoban-shared-ts/sokoban-board-edits';
import { sokobanGameShared } from '@libs/sokoban-shared-ts/sokoban-game';
import { t } from '@lingui/core/macro';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { SokobanEditor } from './sokoban-editor';
import { sokobanLesson } from './sokoban-lesson';
import { SokobanPlayer, SokobanPreview } from './sokoban-player';

export const sokobanGameClient = defineGameClient({
  shared: sokobanGameShared,
  title: 'Sokoban',
  caption: 'Push every crate onto a goal',
  tile: 'crates',
  subtitle: () => <Trans>Push every crate onto a goal, one at a time.</Trans>,
  lesson: sokobanLesson,
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
