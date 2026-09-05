import {
  Box,
  CodeEditor,
  type CodeSelection,
  type CodeToken,
  matchesWebShortcut,
  type WebKeyboardEventLike,
} from '@pkgs/ui';
import type { MutableRefObject, ReactNode } from 'react';
import type { SqlCellProps } from './sql-cell-types';
import { applyCompletion, type completeAt } from './sql-completion';
import { SqlCompletionPopup } from './sql-completion-popup';

export function SqlCellEditor(props: {
  readonly cellProps: SqlCellProps;
  readonly tokenize: (src: string) => readonly CodeToken[];
  readonly completion: ReturnType<typeof completeAt>;
  readonly compIndex: number;
  readonly setCompIndex: (n: number) => void;
  readonly selectionRef: MutableRefObject<CodeSelection>;
  readonly setSelection: (s: CodeSelection) => void;
  readonly run: (andNext: boolean) => Promise<void>;
}): ReactNode {
  const {
    cellProps,
    tokenize,
    completion,
    compIndex,
    setCompIndex,
    selectionRef,
    setSelection,
    run,
  } = props;
  return (
    <Box sx={{ px: 1, pb: 1 }}>
      <CodeEditor
        value={cellProps.cell.sql}
        onChangeText={(v) => {
          cellProps.onFocus();
          cellProps.onChangeSql(v);
          setCompIndex(0);
        }}
        tokenize={tokenize}
        onKeyDown={(ev) =>
          handleCellKeyDown({
            ev,
            completion,
            compIndex,
            setCompIndex,
            sql: cellProps.cell.sql,
            selection: selectionRef.current,
            onChangeSql: cellProps.onChangeSql,
            run,
          })
        }
        onSelectionChange={setSelection}
        minLines={3}
        accessibilityLabel={`SQL cell ${cellProps.index + 1}`}
        trailing={
          completion == null ? null : (
            <SqlCompletionPopup
              result={completion}
              selectedIndex={Math.min(
                compIndex,
                completion.candidates.length - 1
              )}
              onSelect={(label) => {
                const { next } = applyCompletion(
                  cellProps.cell.sql,
                  completion,
                  label
                );
                cellProps.onChangeSql(next);
                setCompIndex(0);
              }}
              onHover={setCompIndex}
            />
          )
        }
      />
    </Box>
  );
}

function handleCellKeyDown(args: {
  readonly ev: WebKeyboardEventLike;
  readonly completion: ReturnType<typeof completeAt>;
  readonly compIndex: number;
  readonly setCompIndex: (n: number) => void;
  readonly sql: string;
  readonly selection: CodeSelection;
  readonly onChangeSql: (sql: string) => void;
  readonly run: (andNext: boolean) => Promise<void>;
}): boolean {
  const {
    ev,
    completion,
    compIndex,
    setCompIndex,
    sql,
    selection,
    onChangeSql,
    run,
  } = args;
  if (completion != null) {
    if (
      handleCompletionNav({
        ev,
        completion,
        compIndex,
        setCompIndex,
        sql,
        onChangeSql,
      })
    ) {
      return true;
    }
  }
  if (matchesWebShortcut('mod+enter', ev)) {
    void run(false);
    return true;
  }
  if (matchesWebShortcut('shift+enter', ev)) {
    void run(true);
    return true;
  }
  if (matchesWebShortcut('tab', ev)) {
    onChangeSql(
      `${sql.slice(0, selection.start)}  ${sql.slice(selection.end)}`
    );
    return true;
  }
  return false;
}

function handleCompletionNav(args: {
  readonly ev: WebKeyboardEventLike;
  readonly completion: NonNullable<ReturnType<typeof completeAt>>;
  readonly compIndex: number;
  readonly setCompIndex: (n: number) => void;
  readonly sql: string;
  readonly onChangeSql: (sql: string) => void;
}): boolean {
  const { ev, completion, compIndex, setCompIndex, sql, onChangeSql } = args;
  const max = completion.candidates.length - 1;
  if (matchesWebShortcut('esc', ev)) {
    setCompIndex(0);
    return true;
  }
  if (ev.key === 'ArrowDown') {
    setCompIndex(Math.min(max, compIndex + 1));
    return true;
  }
  if (ev.key === 'ArrowUp') {
    setCompIndex(Math.max(0, compIndex - 1));
    return true;
  }
  if (matchesWebShortcut('tab', ev) || matchesWebShortcut('enter', ev)) {
    const pick = completion.candidates[compIndex] ?? completion.candidates[0];
    if (pick != null) {
      const { next } = applyCompletion(sql, completion, pick.label);
      onChangeSql(next);
      setCompIndex(0);
    }
    return true;
  }
  return false;
}
