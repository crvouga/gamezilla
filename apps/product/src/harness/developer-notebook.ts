import { ensureActor, scenarioAction } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import {
  addCellAfter,
  createEmptyNotebook,
  duplicateCell,
  removeCell,
  toggleLive,
} from '@pkgs/harness-console/client/sql-notebook/notebook-doc';
import { runSqlCell } from '@pkgs/harness-console/client/sql-notebook/run-sql-cell';
import { tools } from './developer-tools-state';
export const FRIENDS_QUESTION =
  'SELECT id, user_low, user_high FROM friends_friendships';
export const SPACES_QUESTION = 'SELECT id, title FROM spaces';
export const saveNotebookQuestion = scenarioAction({
  name: 'saveNotebookQuestion',
  act: async (
    s,
    actor: string,
    question: 'friends' | 'spaces' | 'invalid',
    options: { automatic?: boolean; two?: boolean } = {}
  ) => {
    await ensureActor(s, actor);
    let doc = createEmptyNotebook({
      nodeId: actor,
      cellId: 'original',
      starterSql:
        question === 'invalid'
          ? 'SELECT * FROM nonexistent_investigation_table'
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
  },
});
export const openNotebook = scenarioAction({
  name: 'openNotebook',
  act: async (s, actor: string) => {
    tools(s).notebook = await tools(s).notebookStore.load(actor);
  },
});
export const editNotebookQuestion = scenarioAction({
  name: 'editNotebookQuestion',
  act: async (s, operation: 'duplicate' | 'remove' | 'run') => {
    const state = tools(s);
    const doc = state.notebook;
    if (doc === null) throw new Error('Notebook is not open');
    if (operation === 'run') {
      const client = await s.harness.client(doc.nodeId);
      const db = await client.openSqlClient();
      state.notebookRun = await runSqlCell({
        sqlClient: db,
        sql: doc.cells[0]?.sql ?? '',
        now: s.harness.clock.now,
      });
      return;
    }
    state.notebook =
      operation === 'duplicate'
        ? duplicateCell({
            doc,
            cellId: 'original',
            newId: s.session.ports.createId(),
          })
        : removeCell(doc, 'original');
    await state.notebookStore.save(state.notebook);
  },
});
export const shownNotebook = (s: ProductHarness) => tools(s).notebook;
export const notebookAnswer = (s: ProductHarness) => tools(s).notebookRun;
export const savedNotebook = (s: ProductHarness, actor: string) =>
  tools(s).notebookStore.load(actor);
