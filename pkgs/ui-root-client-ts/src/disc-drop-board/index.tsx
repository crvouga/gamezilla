import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  type JSX,
  Show,
} from 'solid-js';
import { useGameBoardPreview } from '../game-board-stage/board-preview';
import { Column, landing, nextColumn } from './column';
import styles from './disc-drop-board.module.css';
export type DiscDropBoardProps = {
  readonly cells: readonly number[];
  readonly columns: number;
  readonly rows: number;
  readonly active: number;
  readonly winning: readonly number[];
  readonly interactive: boolean;
  readonly lastCell?: number | undefined;
  readonly label: string;
  /**
   * What to do while the board takes a drop (`Pick a column to drop your
   * disc`): a short line under the columns, and the board's description
   * for assistive technology; `''` while someone else is to move, when the
   * line stays empty at its height, so the board never moves when the turn
   * changes. Leave it out when nobody is to move (the game is over).
   */
  readonly prompt?: string | undefined;
  /**
   * The prompt while a column is pointed at or focused and would take the
   * disc (`Drop in column 6`), so the person reads where it will go before
   * they let go. Leave it out to keep `prompt` throughout.
   */
  readonly previewPrompt?: ((column: number) => string) | undefined;
  /**
   * The game is over: the board scrolls, by as little as it takes, to be
   * fully in view, so the deciding discs are never below the fold.
   */
  readonly finished?: boolean | undefined;
  /** Keyboard guidance, revealed on keyboard focus and described to assistive technology. */
  readonly keyboardHelp?: string | undefined;
  /** Explain a full column and how to choose another while it is targeted. */
  readonly fullColumnPrompt?: ((column: number) => string) | undefined;
  readonly testId: string;
  readonly columnTestId: (column: number) => string;
  readonly cellLabel: (column: number, row: number, disc: number) => string;
  readonly columnLabel: (
    column: number,
    occupied: number,
    full: boolean
  ) => string;
  readonly onDrop: (column: number) => void;
};
/**
 * A board of columns a disc drops down. Each column is one native,
 * full-height button (also a practical touch target) headed by its number.
 * The prompt (`Pick a column to drop your disc`) says what to do in one
 * line under the columns while it is the viewer's move, and describes the
 * board to assistive technology. While the board takes a drop the column
 * pointed at or focused takes a tint and its number a hollow ring in the
 * dropping side's colour, its landing cell shows a dashed, empty outline in
 * that colour (never a disc already played; it breathes slowly, and holds
 * still under reduced motion), and the prompt names the column (`Drop in
 * column 6`).
 * The last disc played falls into place (not under reduced motion), and
 * once four connect their outlines emphasize the win while every disc stays readable. As a
 * `GameBoardStage` preview (a game still being set up) it draws only its
 * discs: no prompt or numbers.
 */
export function DiscDropBoard(props: DiscDropBoardProps): JSX.Element {
  const promptId = createUniqueId();
  const keyboardHelpId = createUniqueId();
  const thumbnail = useGameBoardPreview();
  const prompting = (): boolean => (props.prompt ?? '').length > 0;
  // The prompt is kept while someone is to move, never on a preview.
  const promptLine = (): boolean => props.prompt !== undefined && !thumbnail();
  const [preview, setPreview] = createSignal<number | null>(null);
  const { focused, focus, tabStop, keyboard } = createColumnFocus(() =>
    setPreview(null)
  );
  const columns = createMemo(() =>
    Array.from({ length: props.columns }, (_, n) => n)
  );
  const target = () => {
    const column = preview() ?? focused();
    return props.interactive && column !== null ? landing(props, column) : null;
  };
  const promptText = (): string =>
    boardPrompt(props, target(), preview() ?? focused());
  let root: HTMLDivElement | undefined;
  const navigate = (event: KeyboardEvent, column: number): void => {
    const key = event.key;
    if (key === 'Enter' || key === ' ') {
      focus(column, true);
      return;
    }
    const next = nextColumn(key, column, props.columns);
    if (next === null) return;
    event.preventDefault();
    root?.querySelector<HTMLButtonElement>(`[data-column="${next}"]`)?.focus();
  };
  createFinishReveal(() =>
    props.finished === true && !thumbnail() ? root : undefined
  );
  return (
    <div
      ref={root}
      class={styles['board']}
      {...dataAttrs({ component: 'DiscDropBoard' })}
      role="group"
      aria-label={props.label}
      aria-describedby={describedBy(
        prompting() && promptLine() ? promptId : undefined,
        !thumbnail() && props.keyboardHelp ? keyboardHelpId : undefined
      )}
      data-testid={props.testId}
      data-preview-cell={target() ?? -1}
      data-cells={JSON.stringify(props.cells)}
      data-won={String(props.winning.length > 0)}
      data-keyboard-help={String(keyboard())}
      style={{ '--disc-columns': props.columns }}
    >
      <Show when={promptLine()}>
        <p
          id={promptId}
          class={`${styles['prompt']} text textCaption`}
          data-testid={`${props.testId}-prompt`}
        >
          {promptText()}
        </p>
      </Show>
      <KeyboardHelp
        id={keyboardHelpId}
        text={thumbnail() ? undefined : props.keyboardHelp}
        testId={props.testId}
      />
      <For each={columns()}>
        {(column) => (
          <Column
            board={props}
            column={column}
            thumbnail={thumbnail()}
            target={target()}
            preview={setPreview}
            focus={focus}
            navigate={navigate}
            tabStop={tabStop() === column}
          />
        )}
      </For>
    </div>
  );
}

/** The board's keyboard controls, on a line whose space is always kept. */
function KeyboardHelp(props: {
  id: string;
  text: string | undefined;
  testId: string;
}): JSX.Element {
  return (
    <Show when={props.text}>
      <p
        id={props.id}
        class={`${styles['keyboardHelp']} text textCaption`}
        data-testid={`${props.testId}-keyboard-help`}
      >
        {props.text}
      </p>
    </Show>
  );
}

function describedBy(...ids: (string | undefined)[]): string | undefined {
  return ids.filter(Boolean).join(' ') || undefined;
}

/**
 * The column with keyboard focus, and the board's one Tab stop: the column
 * last focused keeps it, and the arrows, Home and End move between columns.
 */
function createColumnFocus(clearPreview: () => void) {
  const [focused, setFocused] = createSignal<number | null>(null);
  const [tabStop, setTabStop] = createSignal(0);
  // Whether focus came from the keyboard: it shows the keyboard help. A
  // plain attribute, not a :has() rule, so the board's other changes never
  // make the browser re-check it.
  const [keyboard, setKeyboard] = createSignal(false);
  const focus = (column: number | null, fromKeyboard = false): void => {
    setFocused(column);
    setKeyboard(column !== null && fromKeyboard);
    if (column !== null) {
      clearPreview();
      setTabStop(column);
    }
  };
  return { focused, focus, tabStop, keyboard };
}

/** Once the game is over, bring the whole board into view, minimally. */
function createFinishReveal(
  finishedBoard: () => HTMLElement | undefined
): void {
  createEffect(() => {
    finishedBoard()?.scrollIntoView({ block: 'nearest' });
  });
}

/**
 * The prompt line: a full column targeted explains itself, a column that
 * would take the disc names where it lands, otherwise the plain prompt.
 */
function boardPrompt(
  props: DiscDropBoardProps,
  at: number | null,
  column: number | null
): string {
  const prompting = (props.prompt ?? '').length > 0;
  if (props.interactive && prompting && column !== null && at === null)
    return props.fullColumnPrompt?.(column) ?? props.prompt ?? '';
  const named = props.previewPrompt;
  return at !== null && named !== undefined && prompting
    ? named(at % props.columns)
    : (props.prompt ?? '');
}
