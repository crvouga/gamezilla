import { asLocalized } from '@pkgs/i18n';
import {
  CodeEditor,
  type CodeSelection,
  type CodeToken,
  matchesWebShortcut,
  type WebKeyboardEventLike,
} from '@pkgs/ui';
import type { Accessor, JSX } from 'solid-js';

import {
  applyCompletion,
  type CompletionResult,
  type completeAt,
} from './sql-completion';
import { SqlCompletionPopup } from './sql-completion-popup';

export function SqlCellEditor(props: {
  readonly sql: Accessor<string>;
  readonly index: Accessor<number>;
  readonly onFocus: () => void;
  readonly onChangeSql: (sql: string) => void;
  readonly tokenize: (src: string) => readonly CodeToken[];
  readonly completion: Accessor<CompletionResult | null>;
  readonly compIndex: Accessor<number>;
  readonly setCompIndex: (n: number) => void;
  readonly selection: Accessor<CodeSelection>;
  readonly setSelection: (s: CodeSelection) => void;
  readonly run: (andNext: boolean) => Promise<void>;
}): JSX.Element {
  return (
    <div class="box px-1 pb-1">
      <CodeEditor
        value={props.sql()}
        onChangeText={(v) => {
          props.onFocus();
          props.onChangeSql(v);
          props.setCompIndex(0);
        }}
        tokenize={props.tokenize}
        onKeyDown={(ev) =>
          handleCellKeyDown({
            ev,
            completion: props.completion(),
            compIndex: props.compIndex(),
            setCompIndex: props.setCompIndex,
            sql: props.sql(),
            selection: props.selection(),
            onChangeSql: props.onChangeSql,
            run: props.run,
          })
        }
        onSelectionChange={props.setSelection}
        minLines={3}
        aria-label={asLocalized(`SQL cell ${props.index() + 1}`)}
        trailing={(() => {
          const completion = props.completion();
          if (completion == null) return null;
          return (
            <SqlCompletionPopup
              result={completion}
              selectedIndex={props.compIndex}
              onSelect={(label) => {
                const { next } = applyCompletion(
                  props.sql(),
                  completion,
                  label
                );
                props.onChangeSql(next);
                props.setCompIndex(0);
              }}
              onHover={props.setCompIndex}
            />
          );
        })()}
      />
    </div>
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
