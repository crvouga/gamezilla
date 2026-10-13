/**
 * `specs/developer-tools/data-notebook.qnt` against the testing tool's
 * data notebook. Each action leaves the notebook in the state the model names.
 */

import {
  editNotebookQuestion,
  notebookAnswer,
  openNotebook,
  saveNotebookQuestion,
  shownNotebook,
} from '@apps/product/developer-notebook';
import type { ProductHarness } from '@libs/harness/harness';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const ALICE = 'alice';

async function view(s: ProductHarness): Promise<{
  readonly shown: string;
  readonly answered: boolean;
  readonly cutOff: boolean;
}> {
  const doc = shownNotebook(s);
  const cells = doc?.cells ?? [];
  const sql = cells.map((cell) => cell.sql);
  const friends = sql[0]?.includes('friends_friendships') === true;
  const spaces = sql[0]?.includes('FROM spaces') === true;
  const counted = sql[0]?.includes('RECURSIVE') === true;
  const two = cells.length === 2;
  let shown = 'friends';
  if (counted) shown = 'counted';
  else if (two && spaces) shown = 'spaces-first';
  else if (two && friends) shown = 'friends-first';
  else if (spaces) shown = 'spaces';
  const run = notebookAnswer(s);
  const statement = run?.statements[0];
  const rows = statement?.kind === 'rows' ? statement : null;
  return {
    shown,
    answered: rows !== null && run?.error === null,
    cutOff: rows?.truncated === true,
  };
}

bindQuintModel<QuintHarnessWorld>({
  model: 'data-notebook',
  traces: 64,
  maxSteps: 8,
  timeoutMs: 180_000,
  actions: {
    init: (w) => w.s.apply(saveNotebookQuestion, ALICE, 'friends'),
    editQuestion: async (w) => {
      await w.s.apply(saveNotebookQuestion, ALICE, 'friends');
      await w.s.apply(editNotebookQuestion, 'edit-spaces');
    },
    addSecond: (w) =>
      w.s.apply(saveNotebookQuestion, ALICE, 'friends', { two: true }),
    moveLaterAhead: async (w) => {
      await w.s.apply(saveNotebookQuestion, ALICE, 'friends', { two: true });
      await w.s.apply(editNotebookQuestion, 'move-spaces-ahead');
    },
    moveFirstAhead: async (w) => {
      await w.s.apply(saveNotebookQuestion, ALICE, 'friends', { two: true });
      await w.s.apply(editNotebookQuestion, 'move-friends-ahead');
    },
    openAutomatic: async (w) => {
      await w.s.apply(saveNotebookQuestion, ALICE, 'friends', {
        automatic: true,
      });
      await w.s.apply(openNotebook, ALICE);
    },
    runWithinLimit: async (w) => {
      await w.s.apply(saveNotebookQuestion, ALICE, 'count', { rows: 5000 });
      await w.s.apply(editNotebookQuestion, 'run');
    },
    runPastLimit: async (w) => {
      await w.s.apply(saveNotebookQuestion, ALICE, 'count', { rows: 5001 });
      await w.s.apply(editNotebookQuestion, 'run');
    },
  },
  observe: (w) => w.quiet.read(view),
});
