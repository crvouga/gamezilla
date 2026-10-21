import { useClock } from '@pkgs/clock-client/solid';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { executeSqlStatements } from '@pkgs/sql-client-root-shared/statements';
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { Surface } from '@pkgs/ui-root-client/surface';
import { useCreateId } from '@pkgs/uuid-client/solid';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  Match,
  onCleanup,
  type Setter,
  Show,
  Switch,
} from 'solid-js';
import { writeClipboard } from './copy-to-clipboard';
import type { SqlNotebookCell, SqlNotebookDoc } from './notebook-doc';
import {
  addCellAfter,
  duplicateCell,
  encodeNotebookDoc,
  moveCell,
  removeCell,
  setCellSql,
  toggleLive,
} from './notebook-doc';
import type { SqlCellRun } from './run-sql-cell';
import { runSqlCell } from './run-sql-cell';
import { SqlCell } from './sql-cell';
import type { CellInsertApi } from './sql-cell-types';
import type { SqlDialect } from './sql-dialect';
import { detectSqlDialect } from './sql-dialect';
import { SqlNotebookToolbar } from './sql-notebook-toolbar';
import { SqlSchemaDrawer } from './sql-schema-drawer';
import type { NotebookDocSetter } from './use-notebook-doc';
import { useNotebookDoc } from './use-notebook-doc';
import type { SchemaIndex, SchemaWakeSubscribe } from './use-schema-index';
import { useSchemaIndex } from './use-schema-index';

/**
 * Per-node SQL notebook. Replaces the table browser. Notebook SQL is
 * persisted via ObjectStore; results are in-memory. Writes go through the
 * live SqlClient and bypass sync-engine mutation replay (debug surface).
 */
export function SqlNotebookPane(props: {
  readonly sqlClient: SqlClient;
  readonly nodeId: string;
  readonly active?: boolean;
  readonly reloadToken?: number;
  readonly subscribeDomainWake?: SchemaWakeSubscribe;
}): JSX.Element {
  const active = () => props.active ?? true;
  const reloadToken = () => props.reloadToken ?? 0;
  const nodeId = () => props.nodeId;
  const dialect = (): SqlDialect => detectSqlDialect(props.sqlClient);
  const subscribeDomainWake = () => props.subscribeDomainWake;
  const nb = useNotebookDoc({ nodeId, dialect, active });
  const schema = useSchemaIndex({
    sqlClient: props.sqlClient,
    active,
    reloadToken,
    subscribeDomainWake,
  });
  const state = nb.state;
  const errorMessage = () => {
    const s = state();
    return s.status === 'error' ? s.message : null;
  };
  const readyDoc = () => {
    const s = state();
    return s.status === 'ready' ? s.doc : null;
  };

  return (
    <StackVertical grow>
      <Switch>
        <Match when={state().status === 'loading'}>
          <NotebookStatus>
            <LoadingState variant="compact" caption="Loading notebook…" />
          </NotebookStatus>
        </Match>
        <Match when={errorMessage() != null}>
          <NotebookStatus>
            <ErrorState title="Notebook error" body={errorMessage() ?? ''} />
          </NotebookStatus>
        </Match>
      </Switch>
      <Show when={readyDoc()}>
        {(doc) => (
          <ReadyNotebook
            doc={doc}
            setDoc={nb.setDoc}
            resetDoc={nb.resetDoc}
            sqlClient={props.sqlClient}
            dialect={dialect}
            schema={schema}
            active={active}
            reloadToken={reloadToken}
            subscribeDomainWake={subscribeDomainWake}
          />
        )}
      </Show>
    </StackVertical>
  );
}

/** Loading / error block in place of the notebook. */
function NotebookStatus(props: { readonly children: JSX.Element }) {
  return (
    <Surface tone="background" grow padding="2xl" gap="sm">
      {props.children}
    </Surface>
  );
}

function ReadyNotebook(props: {
  readonly doc: Accessor<SqlNotebookDoc>;
  readonly setDoc: NotebookDocSetter;
  readonly resetDoc: () => void;
  readonly sqlClient: SqlClient;
  readonly dialect: Accessor<SqlDialect>;
  readonly schema: SchemaIndex;
  readonly active: Accessor<boolean>;
  readonly reloadToken: Accessor<number>;
  readonly subscribeDomainWake: Accessor<SchemaWakeSubscribe | undefined>;
}): JSX.Element {
  const createId = useCreateId();
  const clock = useClock();
  const [results, setResults] = createSignal<
    Readonly<Record<string, SqlCellRun>>
  >({});
  const [focusId, setFocusId] = createSignal<string | null>(null);
  const insertApi: { current: CellInsertApi | null } = { current: null };

  useLiveRerun({
    doc: props.doc,
    sqlClient: props.sqlClient,
    clock,
    setResults,
    reloadToken: props.reloadToken,
    active: props.active,
    subscribeDomainWake: props.subscribeDomainWake,
  });

  const actions = useNotebookActions({
    doc: props.doc,
    setDoc: props.setDoc,
    resetDoc: props.resetDoc,
    sqlClient: props.sqlClient,
    clock,
    createId,
    setResults,
    focusId,
    setFocusId,
    insertApi,
  });

  return (
    <Surface tone="background" grow testId="sql-notebook">
      <SqlNotebookToolbar dialect={props.dialect} {...actions.toolbar} />
      <NotebookCells
        doc={props.doc}
        setDoc={props.setDoc}
        sqlClient={props.sqlClient}
        dialect={props.dialect}
        schema={props.schema}
        results={results}
        setResults={setResults}
        focusId={focusId}
        setFocusId={setFocusId}
        createId={createId}
        insertApi={insertApi}
      />
      <SqlSchemaDrawer schema={props.schema} {...actions.schema} />
    </Surface>
  );
}

type ResultsMap = Readonly<Record<string, SqlCellRun>>;

function useNotebookActions(args: {
  readonly doc: Accessor<SqlNotebookDoc>;
  readonly setDoc: NotebookDocSetter;
  readonly resetDoc: () => void;
  readonly sqlClient: SqlClient;
  readonly clock: { now: () => number };
  readonly createId: () => string;
  readonly setResults: Setter<ResultsMap>;
  readonly focusId: Accessor<string | null>;
  readonly setFocusId: Setter<string | null>;
  readonly insertApi: { current: CellInsertApi | null };
}) {
  const {
    doc,
    setDoc,
    resetDoc,
    sqlClient,
    clock,
    createId,
    setResults,
    focusId,
    setFocusId,
    insertApi,
  } = args;
  return {
    toolbar: {
      onRunAll: () => void runAllCells({ doc, sqlClient, clock, setResults }),
      onAddCell: () =>
        setDoc((prev) =>
          addCellAfter({
            doc: prev,
            afterId: prev.cells[prev.cells.length - 1]?.id ?? null,
            cell: { id: createId(), sql: '', live: false },
          })
        ),
      onClearResults: () => setResults({}),
      onClearNotebook: resetDoc,
      onExport: () => {
        void writeClipboard(encodeNotebookDoc(doc()));
      },
    },
    schema: {
      onInsertTable: (table: string) => {
        const id = createId();
        setDoc((prev) =>
          addCellAfter({
            doc: prev,
            afterId: focusId() ?? prev.cells[prev.cells.length - 1]?.id ?? null,
            cell: {
              id,
              sql: `SELECT * FROM ${table} LIMIT 100;`,
              live: false,
            },
          })
        );
        setFocusId(id);
      },
      onInsertColumn: (column: string) => {
        insertApi.current?.insertAtCaret(column);
      },
    },
  };
}

function NotebookCells(props: {
  readonly doc: Accessor<SqlNotebookDoc>;
  readonly setDoc: NotebookDocSetter;
  readonly sqlClient: SqlClient;
  readonly dialect: Accessor<SqlDialect>;
  readonly schema: SchemaIndex;
  readonly results: Accessor<ResultsMap>;
  readonly setResults: Setter<ResultsMap>;
  readonly focusId: Accessor<string | null>;
  readonly setFocusId: Setter<string | null>;
  readonly createId: () => string;
  readonly insertApi: { current: CellInsertApi | null };
}): JSX.Element {
  const cellIds = createMemo(() => props.doc().cells.map((c) => c.id));
  return (
    <ScrollView grow tone="background" gap="md" padding="sm">
      <For each={cellIds()}>
        {(id) => {
          const cell = () =>
            props.doc().cells.find((c) => c.id === id) ?? missingCell(id);
          return (
            <SqlCell
              cell={cell}
              index={() => props.doc().cells.findIndex((c) => c.id === id)}
              total={() => props.doc().cells.length}
              sqlClient={props.sqlClient}
              dialect={props.dialect}
              schema={props.schema}
              result={() => props.results()[id] ?? null}
              focused={() => props.focusId() === id}
              onFocus={() => props.setFocusId(id)}
              onChangeSql={(sql) =>
                props.setDoc((prev) => setCellSql(prev, id, sql))
              }
              onToggleLive={() => props.setDoc((prev) => toggleLive(prev, id))}
              onRun={(run) =>
                props.setResults((prev) => ({ ...prev, [id]: run }))
              }
              onRunAndNext={(run) =>
                handleRunAndNext({
                  doc: props.doc,
                  cellId: id,
                  run,
                  createId: props.createId,
                  setDoc: props.setDoc,
                  setResults: props.setResults,
                  setFocusId: props.setFocusId,
                })
              }
              onAddBelow={() =>
                props.setDoc((prev) =>
                  addCellAfter({
                    doc: prev,
                    afterId: id,
                    cell: { id: props.createId(), sql: '', live: false },
                  })
                )
              }
              onRemove={() => {
                props.setDoc((prev) => removeCell(prev, id));
                props.setResults((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
              }}
              onMove={(dir) => props.setDoc((prev) => moveCell(prev, id, dir))}
              onDuplicate={() =>
                props.setDoc((prev) =>
                  duplicateCell({
                    doc: prev,
                    cellId: id,
                    newId: props.createId(),
                  })
                )
              }
              onRegisterInsert={(api) => {
                props.insertApi.current = api;
              }}
            />
          );
        }}
      </For>
    </ScrollView>
  );
}

function useLiveRerun(args: {
  readonly doc: Accessor<SqlNotebookDoc>;
  readonly sqlClient: SqlClient;
  readonly clock: { now: () => number };
  readonly setResults: Setter<ResultsMap>;
  readonly reloadToken: Accessor<number>;
  readonly active: Accessor<boolean>;
  readonly subscribeDomainWake: Accessor<SchemaWakeSubscribe | undefined>;
}): void {
  const {
    doc,
    sqlClient,
    clock,
    setResults,
    reloadToken,
    active,
    subscribeDomainWake,
  } = args;
  const liveCount = createMemo(() => doc().cells.filter((c) => c.live).length);
  const rerunLive = (): void => {
    if (!active()) return;
    for (const cell of doc().cells) {
      if (!cell.live) continue;
      void runSqlCell({
        execute: (statements) => executeSqlStatements(sqlClient, statements),
        sql: cell.sql,
        now: () => clock.now(),
      }).then((run) => {
        setResults((prev) => ({ ...prev, [cell.id]: run }));
      });
    }
  };

  createEffect(() => {
    void reloadToken();
    void doc();
    rerunLive();
  });

  createEffect(() => {
    const subscribe = subscribeDomainWake();
    if (!active() || subscribe === undefined || liveCount() === 0) {
      return;
    }
    void doc();
    const unsub = subscribe(() => {
      rerunLive();
    });
    onCleanup(() => unsub());
  });
}

async function runAllCells(args: {
  readonly doc: Accessor<SqlNotebookDoc>;
  readonly sqlClient: SqlClient;
  readonly clock: { now: () => number };
  readonly setResults: Setter<ResultsMap>;
}): Promise<void> {
  const next: Record<string, SqlCellRun> = {};
  for (const cell of args.doc().cells) {
    next[cell.id] = await runSqlCell({
      execute: (statements) => executeSqlStatements(args.sqlClient, statements),
      sql: cell.sql,
      now: () => args.clock.now(),
    });
  }
  args.setResults(next);
}

function handleRunAndNext(args: {
  readonly doc: Accessor<SqlNotebookDoc>;
  readonly cellId: string;
  readonly run: SqlCellRun;
  readonly createId: () => string;
  readonly setDoc: NotebookDocSetter;
  readonly setResults: Setter<ResultsMap>;
  readonly setFocusId: Setter<string | null>;
}): void {
  const { doc, cellId, run, createId, setDoc, setResults, setFocusId } = args;
  setResults((prev) => ({ ...prev, [cellId]: run }));
  const idx = doc().cells.findIndex((c) => c.id === cellId);
  const next = doc().cells[idx + 1];
  if (next != null) {
    setFocusId(next.id);
    return;
  }
  const id = createId();
  setDoc((prev) =>
    addCellAfter({
      doc: prev,
      afterId: cellId,
      cell: { id, sql: '', live: false },
    })
  );
  setFocusId(id);
}

function missingCell(id: string): SqlNotebookCell {
  return { id, sql: '', live: false };
}
