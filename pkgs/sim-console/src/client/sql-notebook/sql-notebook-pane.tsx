import { useClock } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { Box, ErrorState, LoadingState, ScrollView } from '@pkgs/ui-rn';
import { useCreateId } from '@pkgs/uuid';
import * as Clipboard from 'expo-clipboard';
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  addCellAfter,
  duplicateCell,
  encodeNotebookDoc,
  moveCell,
  removeCell,
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
import { useNotebookDoc } from './use-notebook-doc';
import { type SchemaIndex, useSchemaIndex } from './use-schema-index';

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
  readonly subscribeDomainWake?: (
    listener: (label: string) => void
  ) => () => void;
}): ReactNode {
  const {
    sqlClient,
    nodeId,
    active = true,
    reloadToken = 0,
    subscribeDomainWake,
  } = props;
  const dialect = useMemo(() => detectSqlDialect(sqlClient), [sqlClient]);
  const { state, setDoc, resetDoc } = useNotebookDoc({
    nodeId,
    dialect,
    active,
  });
  const schema = useSchemaIndex({
    sqlClient,
    active,
    reloadToken,
    ...(subscribeDomainWake !== undefined ? { subscribeDomainWake } : {}),
  });

  if (state.status === 'loading') {
    return (
      <Box sx={fillSx}>
        <LoadingState variant="compact" caption="Loading notebook…" />
      </Box>
    );
  }
  if (state.status === 'error') {
    return (
      <Box sx={fillSx}>
        <ErrorState title="Notebook error" body={state.message} />
      </Box>
    );
  }
  return (
    <ReadyNotebook
      doc={state.doc}
      setDoc={setDoc}
      resetDoc={resetDoc}
      sqlClient={sqlClient}
      dialect={dialect}
      schema={schema}
      active={active}
      reloadToken={reloadToken}
      {...(subscribeDomainWake !== undefined ? { subscribeDomainWake } : {})}
    />
  );
}

const fillSx = {
  flex: 1,
  minHeight: 0,
  padding: 8,
  gap: 2,
} as const;

function ReadyNotebook(props: {
  readonly doc: SqlNotebookDoc;
  readonly setDoc: Dispatch<SetStateAction<SqlNotebookDoc>>;
  readonly resetDoc: () => void;
  readonly sqlClient: SqlClient;
  readonly dialect: SqlDialect;
  readonly schema: SchemaIndex;
  readonly active: boolean;
  readonly reloadToken: number;
  readonly subscribeDomainWake?: (
    listener: (label: string) => void
  ) => () => void;
}): ReactNode {
  const {
    doc,
    setDoc,
    resetDoc,
    sqlClient,
    dialect,
    schema,
    active,
    reloadToken,
    subscribeDomainWake,
  } = props;
  const createId = useCreateId();
  const clock = useClock();
  const [results, setResults] = useState<Readonly<Record<string, SqlCellRun>>>(
    {}
  );
  const [focusId, setFocusId] = useState<string | null>(null);
  const insertApi = useRef<CellInsertApi | null>(null);

  useLiveRerun({
    active,
    doc,
    sqlClient,
    clock,
    setResults,
    reloadToken,
    ...(subscribeDomainWake !== undefined ? { subscribeDomainWake } : {}),
  });

  const actions = useNotebookActions({
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
  });

  return (
    <Box
      sx={{ flex: 1, minHeight: 0, minWidth: 0 }}
      dataSet={{ component: 'SqlNotebookPane' }}
    >
      <SqlNotebookToolbar dialect={dialect} {...actions.toolbar} />
      <NotebookCells
        doc={doc}
        setDoc={setDoc}
        sqlClient={sqlClient}
        dialect={dialect}
        schema={schema}
        results={results}
        setResults={setResults}
        focusId={focusId}
        setFocusId={setFocusId}
        createId={createId}
        insertApi={insertApi}
      />
      <SqlSchemaDrawer schema={schema} {...actions.schema} />
    </Box>
  );
}

function useNotebookActions(args: {
  readonly doc: SqlNotebookDoc;
  readonly setDoc: Dispatch<SetStateAction<SqlNotebookDoc>>;
  readonly resetDoc: () => void;
  readonly sqlClient: SqlClient;
  readonly clock: { now: () => number };
  readonly createId: () => string;
  readonly setResults: Dispatch<
    SetStateAction<Readonly<Record<string, SqlCellRun>>>
  >;
  readonly focusId: string | null;
  readonly setFocusId: (id: string | null) => void;
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
        setDoc(
          addCellAfter({
            doc,
            afterId: doc.cells[doc.cells.length - 1]?.id ?? null,
            cell: { id: createId(), sql: '', live: false },
          })
        ),
      onClearResults: () => setResults({}),
      onClearNotebook: resetDoc,
      onExport: () => {
        void Clipboard.setStringAsync(encodeNotebookDoc(doc));
      },
    },
    schema: {
      onInsertTable: (table: string) => {
        const id = createId();
        setDoc(
          addCellAfter({
            doc,
            afterId: focusId ?? doc.cells[doc.cells.length - 1]?.id ?? null,
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
  readonly doc: SqlNotebookDoc;
  readonly setDoc: Dispatch<SetStateAction<SqlNotebookDoc>>;
  readonly sqlClient: SqlClient;
  readonly dialect: SqlDialect;
  readonly schema: SchemaIndex;
  readonly results: Readonly<Record<string, SqlCellRun>>;
  readonly setResults: Dispatch<
    SetStateAction<Readonly<Record<string, SqlCellRun>>>
  >;
  readonly focusId: string | null;
  readonly setFocusId: (id: string | null) => void;
  readonly createId: () => string;
  readonly insertApi: { current: CellInsertApi | null };
}): ReactNode {
  const {
    doc,
    setDoc,
    sqlClient,
    dialect,
    schema,
    results,
    setResults,
    focusId,
    setFocusId,
    createId,
    insertApi,
  } = props;
  return (
    <ScrollView sx={{ gap: 2, padding: 2 }} frameSx={{ flex: 1, minHeight: 0 }}>
      {doc.cells.map((cell, index) => (
        <SqlCell
          key={cell.id}
          cell={cell}
          index={index}
          total={doc.cells.length}
          sqlClient={sqlClient}
          dialect={dialect}
          schema={schema}
          result={results[cell.id] ?? null}
          focused={focusId === cell.id}
          onFocus={() => setFocusId(cell.id)}
          onChangeSql={(sql) => setDoc(setCellSql(doc, cell.id, sql))}
          onToggleLive={() => setDoc(toggleLive(doc, cell.id))}
          onRun={(run) => setResults((prev) => ({ ...prev, [cell.id]: run }))}
          onRunAndNext={(run) =>
            handleRunAndNext({
              doc,
              cellId: cell.id,
              run,
              createId,
              setDoc,
              setResults,
              setFocusId,
            })
          }
          onAddBelow={() =>
            setDoc(
              addCellAfter({
                doc,
                afterId: cell.id,
                cell: { id: createId(), sql: '', live: false },
              })
            )
          }
          onRemove={() => {
            setDoc(removeCell(doc, cell.id));
            setResults((prev) => {
              const next = { ...prev };
              delete next[cell.id];
              return next;
            });
          }}
          onMove={(dir) => setDoc(moveCell(doc, cell.id, dir))}
          onDuplicate={() =>
            setDoc(duplicateCell({ doc, cellId: cell.id, newId: createId() }))
          }
          onRegisterInsert={(api) => {
            insertApi.current = api;
          }}
        />
      ))}
    </ScrollView>
  );
}

function useLiveRerun(args: {
  readonly active: boolean;
  readonly doc: SqlNotebookDoc;
  readonly sqlClient: SqlClient;
  readonly clock: { now: () => number };
  readonly setResults: Dispatch<
    SetStateAction<Readonly<Record<string, SqlCellRun>>>
  >;
  readonly reloadToken: number;
  readonly subscribeDomainWake?: (
    listener: (label: string) => void
  ) => () => void;
}): void {
  const {
    active,
    doc,
    sqlClient,
    clock,
    setResults,
    reloadToken,
    subscribeDomainWake,
  } = args;
  const liveCount = doc.cells.filter((c) => c.live).length;
  const rerunLive = useCallback(() => {
    if (!active) return;
    for (const cell of doc.cells) {
      if (!cell.live) continue;
      void runSqlCell({
        sqlClient,
        sql: cell.sql,
        now: () => clock.now(),
      }).then((run) => {
        setResults((prev) => ({ ...prev, [cell.id]: run }));
      });
    }
  }, [active, doc, sqlClient, clock, setResults]);

  useEffect(() => {
    rerunLive();
  }, [rerunLive, reloadToken]);

  useEffect(() => {
    if (!active || subscribeDomainWake === undefined || liveCount === 0) {
      return;
    }
    return subscribeDomainWake(() => {
      rerunLive();
    });
  }, [active, subscribeDomainWake, liveCount, rerunLive]);
}

async function runAllCells(args: {
  readonly doc: SqlNotebookDoc;
  readonly sqlClient: SqlClient;
  readonly clock: { now: () => number };
  readonly setResults: Dispatch<
    SetStateAction<Readonly<Record<string, SqlCellRun>>>
  >;
}): Promise<void> {
  const next: Record<string, SqlCellRun> = {};
  for (const cell of args.doc.cells) {
    next[cell.id] = await runSqlCell({
      sqlClient: args.sqlClient,
      sql: cell.sql,
      now: () => args.clock.now(),
    });
  }
  args.setResults(next);
}

function handleRunAndNext(args: {
  readonly doc: SqlNotebookDoc;
  readonly cellId: string;
  readonly run: SqlCellRun;
  readonly createId: () => string;
  readonly setDoc: Dispatch<SetStateAction<SqlNotebookDoc>>;
  readonly setResults: Dispatch<
    SetStateAction<Readonly<Record<string, SqlCellRun>>>
  >;
  readonly setFocusId: (id: string | null) => void;
}): void {
  const { doc, cellId, run, createId, setDoc, setResults, setFocusId } = args;
  setResults((prev) => ({ ...prev, [cellId]: run }));
  const idx = doc.cells.findIndex((c) => c.id === cellId);
  const next = doc.cells[idx + 1];
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
