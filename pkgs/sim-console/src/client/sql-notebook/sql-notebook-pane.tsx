import { useClock } from '@pkgs/clock/solid';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { ErrorState, LoadingState, ScrollView } from '@pkgs/ui';
import { useCreateId } from '@pkgs/uuid/solid';
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
import {
  addCellAfter,
  duplicateCell,
  encodeNotebookDoc,
  moveCell,
  removeCell,
  type SqlNotebookCell,
  type SqlNotebookDoc,
  setCellSql,
  toggleLive,
} from './notebook-doc';
import type { SqlCellRun } from './run-sql-cell';
import { runSqlCell } from './run-sql-cell';
import { type CellInsertApi, SqlCell } from './sql-cell';
import { detectSqlDialect, type SqlDialect } from './sql-dialect';
import { SqlNotebookToolbar } from './sql-notebook-toolbar';
import { SqlSchemaDrawer } from './sql-schema-drawer';
import { type NotebookDocSetter, useNotebookDoc } from './use-notebook-doc';
import {
  type SchemaIndex,
  type SchemaWakeSubscribe,
  useSchemaIndex,
} from './use-schema-index';

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
    <div class="box flex-1 min-h-[0]">
      <Switch>
        <Match when={state().status === 'loading'}>
          <div class="box" style={fillSx}>
            <LoadingState variant="compact" caption="Loading notebook…" />
          </div>
        </Match>
        <Match when={errorMessage() != null}>
          <div class="box" style={fillSx}>
            <ErrorState title="Notebook error" body={errorMessage() ?? ''} />
          </div>
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
    </div>
  );
}

const fillSx = {
  flex: 1,
  'min-height': 0,
  padding: '32px',
  gap: '8px',
} as const;

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
    <div
      class="box flex-1 min-h-[0] min-w-[0]"
      data-component="SqlNotebookPane"
    >
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
    </div>
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
    <ScrollView class="flex-1 min-h-[0]" contentClass="gap-2 p-[2px]">
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
        sqlClient,
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
      sqlClient: args.sqlClient,
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
