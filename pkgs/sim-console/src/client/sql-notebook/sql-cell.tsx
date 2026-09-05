import { useClock } from '@pkgs/clock';
import {
  Box,
  ChevronDownIcon,
  type CodeSelection,
  CopyIcon,
  IconButton,
  PlayIcon,
  PlusIcon,
  Switch,
  Text,
  Trash2Icon,
} from '@pkgs/ui';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { runSqlCell } from './run-sql-cell';
import { SqlCellEditor } from './sql-cell-editor';
import { SqlCellResults } from './sql-cell-results';
import type { SqlCellProps } from './sql-cell-types';
import { completeAt } from './sql-completion';
import { sqlKeywordsForDialect } from './sql-dialect';
import { tokenizeSql } from './sql-tokenize';

export type { CellInsertApi, SqlCellProps } from './sql-cell-types';

export function SqlCell(props: SqlCellProps): ReactNode {
  const clock = useClock();
  const [selection, setSelection] = useState<CodeSelection>({
    start: 0,
    end: 0,
  });
  const [compIndex, setCompIndex] = useState(0);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  useRegisterInsert(props, selectionRef);

  const catalog = useMemo(
    () => ({
      keywords: sqlKeywordsForDialect(props.dialect),
      tables: props.schema.tables.map((t) => t.name),
      columns: props.schema.allColumns,
    }),
    [props.dialect, props.schema]
  );
  const completion = useMemo(
    () => completeAt(props.cell.sql, selection.start, catalog),
    [props.cell.sql, selection.start, catalog]
  );
  const tokenize = useCallback(
    (src: string) => tokenizeSql(src, props.dialect),
    [props.dialect]
  );
  const run = useCallback(
    async (andNext: boolean) => {
      const out = await runSqlCell({
        sqlClient: props.sqlClient,
        sql: props.cell.sql,
        now: () => clock.now(),
      });
      if (andNext) props.onRunAndNext(out);
      else props.onRun(out);
    },
    [clock, props]
  );

  return (
    <Box
      sx={{
        borderWidth: 1,
        borderColor: props.focused ? 'tint' : 'outline',
        borderRadius: 'md',
        overflow: 'hidden',
        background: 'surface',
      }}
      dataSet={{ component: 'SqlCell' }}
    >
      <CellChrome {...chromeProps(props, () => void run(false))} />
      <SqlCellEditor
        cellProps={props}
        tokenize={tokenize}
        completion={completion}
        compIndex={compIndex}
        setCompIndex={setCompIndex}
        selectionRef={selectionRef}
        setSelection={setSelection}
        run={run}
      />
      {props.result != null ? (
        <SqlCellResults
          results={props.result.statements}
          durationMs={props.result.durationMs}
          error={props.result.error}
        />
      ) : null}
    </Box>
  );
}

function useRegisterInsert(
  props: SqlCellProps,
  selectionRef: { current: CodeSelection }
): void {
  const { onRegisterInsert, onChangeSql, cell, focused } = props;
  useEffect(() => {
    if (!focused) {
      onRegisterInsert(null);
      return;
    }
    onRegisterInsert({
      insertAtCaret: (text) => {
        const { start, end } = selectionRef.current;
        onChangeSql(cell.sql.slice(0, start) + text + cell.sql.slice(end));
      },
      setSql: onChangeSql,
    });
    return () => onRegisterInsert(null);
  }, [focused, onRegisterInsert, onChangeSql, cell.sql, selectionRef]);
}

function chromeProps(props: SqlCellProps, onRun: () => void) {
  return {
    index: props.index,
    total: props.total,
    live: props.cell.live,
    onRun,
    onToggleLive: props.onToggleLive,
    onAddBelow: props.onAddBelow,
    onRemove: props.onRemove,
    onMove: props.onMove,
    onDuplicate: props.onDuplicate,
  };
}

function CellChrome(props: {
  readonly index: number;
  readonly total: number;
  readonly live: boolean;
  readonly onRun: () => void;
  readonly onToggleLive: () => void;
  readonly onAddBelow: () => void;
  readonly onRemove: () => void;
  readonly onMove: (dir: -1 | 1) => void;
  readonly onDuplicate: () => void;
}): ReactNode {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.5,
        background: 'surfaceMuted',
      }}
    >
      <Text
        sx={{ fontSize: 11, color: 'textSecondary', px: 1 }}
        label={`[${props.index + 1}]`}
      />
      <IconButton
        label="Run cell"
        size={26}
        tooltip="hover"
        onPress={props.onRun}
      >
        <PlayIcon size={12} />
      </IconButton>
      <IconButton
        label="Add below"
        size={26}
        tooltip="hover"
        onPress={props.onAddBelow}
      >
        <PlusIcon size={12} />
      </IconButton>
      <IconButton
        label="Move up"
        size={26}
        tooltip="hover"
        onPress={() => props.onMove(-1)}
      >
        <ChevronDownIcon size={12} sx={{ transform: [{ rotate: '180deg' }] }} />
      </IconButton>
      <IconButton
        label="Move down"
        size={26}
        tooltip="hover"
        onPress={() => props.onMove(1)}
      >
        <ChevronDownIcon size={12} />
      </IconButton>
      <IconButton
        label="Duplicate"
        size={26}
        tooltip="hover"
        onPress={props.onDuplicate}
      >
        <CopyIcon size={12} />
      </IconButton>
      <IconButton
        label="Delete cell"
        size={26}
        tooltip="hover"
        onPress={props.onRemove}
      >
        <Trash2Icon size={12} />
      </IconButton>
      <Box sx={{ flex: 1 }} />
      <Switch
        label="Live"
        value={props.live}
        onValueChange={() => props.onToggleLive()}
      />
    </Box>
  );
}
