import { useClock } from '@pkgs/clock-client-ts/solid';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { executeSqlStatements } from '@pkgs/sql-client-root-shared-ts/statements';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
} from '@pkgs/ui-root-client-ts/icons';
import { Pane } from '@pkgs/ui-root-client-ts/pane';
import { Spacer } from '@pkgs/ui-root-client-ts/spacer';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Switch } from '@pkgs/ui-root-client-ts/switch';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { Toolbar } from '@pkgs/ui-root-client-ts/toolbar';
import type { CodeSelection } from '@pkgs/ui-root-shared-ts/code-editor-types';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';

import type { SqlNotebookCell } from './notebook-doc';
import type { SqlCellRun } from './run-sql-cell';
import { runSqlCell } from './run-sql-cell';
import { SqlCellEditor } from './sql-cell-editor';
import { SqlCellResults } from './sql-cell-results';
import type { CellInsertApi } from './sql-cell-types';
import { completeAt } from './sql-completion';
import type { SqlDialect } from './sql-dialect';
import { sqlKeywordsForDialect } from './sql-dialect';
import { tokenizeSql } from './sql-tokenize';
import type { SchemaIndex } from './use-schema-index';

type SqlCellRenderProps = {
  readonly cell: Accessor<SqlNotebookCell>;
  readonly index: Accessor<number>;
  readonly total: Accessor<number>;
  readonly sqlClient: SqlClient;
  readonly dialect: Accessor<SqlDialect>;
  readonly schema: SchemaIndex;
  readonly result: Accessor<SqlCellRun | null>;
  readonly focused: Accessor<boolean>;
  readonly onFocus: () => void;
  readonly onChangeSql: (sql: string) => void;
  readonly onToggleLive: () => void;
  readonly onRun: (run: SqlCellRun) => void;
  readonly onRunAndNext: (run: SqlCellRun) => void;
  readonly onAddBelow: () => void;
  readonly onRemove: () => void;
  readonly onMove: (dir: -1 | 1) => void;
  readonly onDuplicate: () => void;
  readonly onRegisterInsert: (api: CellInsertApi | null) => void;
};

export function SqlCell(props: SqlCellRenderProps): JSX.Element {
  const clock = useClock();
  const [selection, setSelection] = createSignal<CodeSelection>({
    start: 0,
    end: 0,
  });
  const [compIndex, setCompIndex] = createSignal(0);
  useRegisterInsert(props, selection);

  const catalog = createMemo(() => ({
    keywords: sqlKeywordsForDialect(props.dialect()),
    tables: props.schema.tables().map((t) => t.name),
    columns: props.schema.allColumns(),
  }));
  const completion = createMemo(() =>
    completeAt(props.cell().sql, selection().start, catalog())
  );
  const tokenize = (src: string) => tokenizeSql(src, props.dialect());
  const run = async (andNext: boolean) => {
    const out = await runSqlCell({
      execute: (statements) =>
        executeSqlStatements(props.sqlClient, statements),
      sql: props.cell().sql,
      now: () => clock.now(),
    });
    if (andNext) props.onRunAndNext(out);
    else props.onRun(out);
  };

  return (
    <Pane
      grow={false}
      border
      focused={props.focused()}
      tone="surface"
      radius="control"
      dataSet={{ component: 'SqlCell' }}
    >
      <CellChrome
        index={props.index}
        total={props.total}
        live={() => props.cell().live}
        onRun={() => void run(false)}
        onToggleLive={props.onToggleLive}
        onAddBelow={props.onAddBelow}
        onRemove={props.onRemove}
        onMove={props.onMove}
        onDuplicate={props.onDuplicate}
      />
      <SqlCellEditor
        sql={() => props.cell().sql}
        index={props.index}
        onFocus={props.onFocus}
        onChangeSql={props.onChangeSql}
        tokenize={tokenize}
        completion={completion}
        compIndex={compIndex}
        setCompIndex={(n) => setCompIndex(n)}
        selection={selection}
        setSelection={(s) => setSelection(s)}
        run={run}
      />
      <Show when={props.result()}>
        {(result) => (
          <SqlCellResults
            results={() => result().statements}
            durationMs={() => result().durationMs}
            error={() => result().error}
          />
        )}
      </Show>
    </Pane>
  );
}

function useRegisterInsert(
  props: SqlCellRenderProps,
  selection: Accessor<CodeSelection>
): void {
  const { onRegisterInsert, onChangeSql } = props;
  createEffect(() => {
    const cell = props.cell();
    const focused = props.focused();
    if (!focused) {
      onRegisterInsert(null);
      return;
    }
    onRegisterInsert({
      insertAtCaret: (text) => {
        const { start, end } = selection();
        onChangeSql(cell.sql.slice(0, start) + text + cell.sql.slice(end));
      },
      setSql: onChangeSql,
    });
    onCleanup(() => onRegisterInsert(null));
  });
}

function CellChrome(props: {
  readonly index: Accessor<number>;
  readonly total: Accessor<number>;
  readonly live: Accessor<boolean>;
  readonly onRun: () => void;
  readonly onToggleLive: () => void;
  readonly onAddBelow: () => void;
  readonly onRemove: () => void;
  readonly onMove: (dir: -1 | 1) => void;
  readonly onDuplicate: () => void;
}): JSX.Element {
  return (
    <Toolbar edge="none" aria-label={`Cell ${props.index() + 1}`}>
      <StackVertical paddingX="xs">
        <Text variant="footnote" numeral>{`[${props.index() + 1}]`}</Text>
      </StackVertical>
      <IconButton
        label="Run cell"
        size={26}
        tooltip="hover"
        onClick={props.onRun}
      >
        <PlayIcon size={12} color="icon" />
      </IconButton>
      <IconButton
        label="Add below"
        size={26}
        tooltip="hover"
        onClick={props.onAddBelow}
      >
        <PlusIcon size={12} color="icon" />
      </IconButton>
      <IconButton
        label="Move up"
        size={26}
        tooltip="hover"
        onClick={() => props.onMove(-1)}
      >
        <ChevronUpIcon size={12} color="icon" />
      </IconButton>
      <IconButton
        label="Move down"
        size={26}
        tooltip="hover"
        onClick={() => props.onMove(1)}
      >
        <ChevronDownIcon size={12} color="icon" />
      </IconButton>
      <IconButton
        label="Duplicate"
        size={26}
        tooltip="hover"
        onClick={props.onDuplicate}
      >
        <CopyIcon size={12} color="icon" />
      </IconButton>
      <IconButton
        label="Delete cell"
        size={26}
        tooltip="hover"
        onClick={props.onRemove}
      >
        <Trash2Icon size={12} color="icon" />
      </IconButton>
      <Spacer />
      <Switch
        label="Live"
        value={props.live()}
        onValueChange={() => props.onToggleLive()}
      />
    </Toolbar>
  );
}
