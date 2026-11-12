import { ensureActor, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  addCellAfter,
  createEmptyNotebook,
  duplicateCell,
  moveCell,
  removeCell,
  setCellSql,
  toggleLive,
} from '@pkgs/harness-console-client-ts/notebook-doc';
import { runSqlCell } from '@pkgs/harness-console-client-ts/run-sql-cell';
import { tools } from './developer-tools-state';

async function notebookExecutor(s: ProductHarness, actorId: string) {
  await ensureActor(s, actorId);
  const actor = s.actors.get(actorId);
  if (actor === undefined) throw new Error(`Device ${actorId} unavailable`);
  return actor.executeStatements;
}
export const FRIENDS_QUESTION =
  'SELECT id, user_low, user_high FROM friends_friendships';
export const SPACES_QUESTION = 'SELECT id, title FROM spaces';
export const ANSWER_ROW_LIMIT = 5000;

function countingQuestion(rows: number): string {
  return `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${String(rows)}) SELECT i FROM n`;
}
export const saveNotebookQuestion = scenarioAction({
  name: 'saveNotebookQuestion',
  act: async (
    s,
    actor: string,
    question: 'friends' | 'spaces' | 'invalid' | 'count',
    options: { automatic?: boolean; two?: boolean; rows?: number } = {}
  ) => {
    await ensureActor(s, actor);
    let doc = createEmptyNotebook({
      nodeId: actor,
      cellId: 'original',
      starterSql:
        question === 'invalid'
          ? 'SELECT * FROM nonexistent_investigation_table'
          : question === 'count'
            ? countingQuestion(options.rows ?? ANSWER_ROW_LIMIT)
            : question === 'friends'
              ? FRIENDS_QUESTION
              : SPACES_QUESTION,
    });
    if (options.automatic) doc = toggleLive(doc, 'original');
    if (options.two)
      doc = addCellAfter({
        doc,
        afterId: 'original',
        cell: { id: 'spaces', sql: SPACES_QUESTION, live: false },
      });
    const state = tools(s);
    await state.notebookStore.save(doc);
    state.notebook = doc;
    // A newly saved question has not been run, so a previous answer is gone.
    state.notebookRun = null;
  },
});
export const openNotebook = scenarioAction({
  name: 'openNotebook',
  act: async (s, actor: string) => {
    const state = tools(s);
    const doc = await state.notebookStore.load(actor);
    state.notebook = doc;
    const live = doc?.cells.find((cell) => cell.live);
    if (doc === null || live === undefined) {
      state.notebookRun = null;
      return;
    }
    const execute = await notebookExecutor(s, doc.nodeId);
    state.notebookRun = await runSqlCell({
      execute,
      sql: live.sql,
      now: s.harness.clock.now,
    });
  },
});
export const editNotebookQuestion = scenarioAction({
  name: 'editNotebookQuestion',
  act: async (
    s,
    operation:
      | 'duplicate'
      | 'remove'
      | 'run'
      | 'edit-spaces'
      | 'move-spaces-ahead'
      | 'move-friends-ahead'
  ) => {
    const state = tools(s);
    const doc = state.notebook;
    if (doc === null) throw new Error('Notebook is not open');
    if (operation === 'run') {
      const execute = await notebookExecutor(s, doc.nodeId);
      state.notebookRun = await runSqlCell({
        execute,
        sql: doc.cells[0]?.sql ?? '',
        now: s.harness.clock.now,
      });
      return;
    }
    if (operation === 'edit-spaces')
      state.notebook = setCellSql(doc, 'original', SPACES_QUESTION);
    else if (operation === 'move-spaces-ahead')
      state.notebook = moveCell(doc, 'spaces', -1);
    else if (operation === 'move-friends-ahead')
      state.notebook = moveCell(doc, 'original', -1);
    else
      state.notebook =
        operation === 'duplicate'
          ? duplicateCell({
              doc,
              cellId: 'original',
              newId: s.session.ports.createId(),
            })
          : removeCell(doc, 'original');
    await state.notebookStore.save(state.notebook);
    // Changing, moving, copying, or removing a question drops the old answer.
    state.notebookRun = null;
  },
});
export const shownNotebook = (s: ProductHarness) => tools(s).notebook;
export const notebookAnswer = (s: ProductHarness) => tools(s).notebookRun;
export const savedNotebook = (s: ProductHarness, actor: string) =>
  tools(s).notebookStore.load(actor);
