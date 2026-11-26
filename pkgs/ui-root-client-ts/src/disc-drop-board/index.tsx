import { ariaBoolean } from '@pkgs/ui-root-shared-ts/aria-boolean';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Button as SdkButton } from '@ui-sdk/solid/button';
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  Show,
} from 'solid-js';
import {
  createBoardArrival,
  useGameBoardPreview,
} from '../game-board-stage/board-presentation';
import styles from './disc-drop-board.module.css';
import { RackViewport } from './rack-gestures';
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
  readonly inspection?: {
    enlarge: string;
    fit: string;
    guidance: string;
    columnLabel: (column: number, occupied: number, full: boolean) => string;
  };
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
 * that colour. The prompt names the column (`Drop in
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
  let root: HTMLDivElement | undefined;
  const input = createBoardInput(props, () => root);
  createFinishReveal(
    () => props.finished === true && !thumbnail(),
    () => root
  );
  return (
    <div
      ref={root}
      class={styles['board']}
      role="group"
      aria-label={props.label}
      aria-keyshortcuts={props.inspection ? 'I Escape' : undefined}
      aria-describedby={describedBy(
        prompting() && promptLine() ? promptId : undefined,
        !thumbnail() && props.keyboardHelp ? keyboardHelpId : undefined
      )}
      data-testid={props.testId}
      data-preview-cell={input.target() ?? -1}
      data-cells={JSON.stringify(props.cells)}
      data-won={String(props.winning.length > 0)}
      data-keyboard-help={String(input.keyboard())}
      data-inspecting={String(input.inspecting())}
      {...dataAttrs({ component: 'DiscDropBoard' })}
      style={{ '--disc-columns': props.columns }}
    >
      <Show when={promptLine()}>
        <p
          id={promptId}
          data-turn={
            !input.inspecting() && prompting() && props.interactive
              ? props.active
              : undefined
          }
          class={`${styles['prompt']} text textCaption`}
          data-testid={`${props.testId}-prompt`}
        >
          {/* An empty line still holds a line box of the same height as a
              written one, so the board never moves when the prompt clears. */}
          {input.promptText() || '\u00a0'}
        </p>
      </Show>
      <KeyboardHelp
        id={keyboardHelpId}
        text={thumbnail() ? undefined : props.keyboardHelp}
        testId={props.testId}
      />
      <RackViewport
        board={props}
        enabled={!thumbnail() && props.inspection !== undefined}
        preview={input.setPreview}
        inspect={input.setInspecting}
        commit={input.drop}
        register={input.registerInspection}
      >
        <For each={input.columns()}>
          {(column) => (
            <Column
              board={props}
              inspecting={input.inspecting()}
              column={column}
              thumbnail={thumbnail()}
              target={input.target()}
              preview={input.setPreview}
              focus={input.focus}
              navigate={input.navigate}
              tabStop={input.tabStop() === column}
            />
          )}
        </For>
      </RackViewport>
      <Show when={!thumbnail() && props.inspection}>
        {(labels) => (
          <button
            tabindex={-1}
            aria-keyshortcuts="I Escape"
            type="button"
            class={styles['inspect']}
            onClick={input.toggleInspection}
          >
            {input.inspecting() ? labels().fit : labels().enlarge}
          </button>
        )}
      </Show>
    </div>
  );
}

function createBoardInput(
  props: DiscDropBoardProps,
  root: () => HTMLDivElement | undefined
) {
  let toggle: (() => void) | undefined;
  const [inspecting, setInspecting] = createSignal(false);
  const [preview, setPreview] = createSignal<number | null>(null);
  const { focused, focus, tabStop, keyboard } = createColumnFocus(() =>
    setPreview(null)
  );
  const columns = createMemo(() =>
    Array.from({ length: props.columns }, (_, n) => n)
  );
  const target = () => {
    const column = preview() ?? focused();
    return !inspecting() && props.interactive && column !== null && column >= 0
      ? landing(props, column)
      : null;
  };
  const promptText = (): string =>
    inspecting()
      ? (props.inspection?.guidance ?? '')
      : boardPrompt(props, target(), preview() ?? focused());
  const navigate = (event: KeyboardEvent, column: number): void => {
    const key = event.key;
    if (key === 'Enter' || key === ' ') {
      focus(column, true);
      return;
    }
    const next = nextColumn(key, column, props.columns);
    if (next === null) return;
    event.preventDefault();
    root()
      ?.querySelector<HTMLButtonElement>(`[data-column="${next}"]`)
      ?.focus();
  };
  return {
    registerInspection(action: () => void) {
      toggle = action;
    },
    toggleInspection: () => toggle?.(),
    drop(column: number) {
      if (landing(props, column) !== null) props.onDrop(column);
    },
    inspecting,
    setInspecting,
    setPreview,
    focus,
    tabStop,
    keyboard,
    columns,
    target,
    promptText,
    navigate,
  };
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
  finished: () => boolean,
  board: () => HTMLElement | undefined
): void {
  createEffect(finished, (over) => {
    if (over) board()?.scrollIntoView({ block: 'nearest' });
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
  if (
    props.interactive &&
    prompting &&
    column !== null &&
    column >= 0 &&
    at === null
  )
    return props.fullColumnPrompt?.(column) ?? props.prompt ?? '';
  const named = props.previewPrompt;
  return at !== null && named !== undefined && prompting
    ? named(at % props.columns)
    : (props.prompt ?? '');
}

function landing(board: DiscDropBoardProps, column: number): number | null {
  for (let row = 0; row < board.rows; row++)
    if (board.cells[row * board.columns + column] === 0)
      return row * board.columns + column;
  return null;
}
function DiscCell(props: {
  board: DiscDropBoardProps;
  column: number;
  row: number;
  target: number | null;
}): JSX.Element {
  const index = () => props.row * props.board.columns + props.column;
  const disc = () => props.board.cells[index()] ?? 0;
  const arrived = createBoardArrival(() => disc() !== 0);
  // A played disc carries its side's mark; the landing preview never does
  // (a dashed, empty outline), so it can never be read as a disc played.
  const marker = () => (disc() !== 0 ? discMark(disc()) : '');
  return (
    <span
      class={styles['cell']}
      data-testid={`${props.board.testId}-cell-${index()}`}
      data-cell={index()}
      data-disc={disc()}
      data-arrived={arrived() || undefined}
      data-preview={String(props.target === index())}
      data-preview-disc={props.target === index() ? props.board.active : 0}
      data-winning={String(props.board.winning.includes(index()))}
      data-last={String(props.board.lastCell === index() && disc() !== 0)}
      style={{ '--disc-distance': `${-(props.board.rows - props.row) * 100}%` }}
    >
      <span class={styles['disc']} aria-hidden="true">
        {marker()}
      </span>
    </span>
  );
}
/** The disc each side drops: its mark, inside its fill. */
function discMark(disc: number): string {
  return disc === 1 ? '●' : disc === 2 ? '◆' : '';
}

/**
 * Above a column: its number, as the record writes its moves (counted from
 * 1). The column pointed at or focused rings its number in the dropping
 * side's colour (a hollow disc in the drop slot), over the column's tint
 * and the dashed outline where it would land. A preview draws no numbers.
 */
function DropMarker(props: {
  board: DiscDropBoardProps;
  column: number;
  previewed: boolean;
}): JSX.Element {
  return (
    <span
      class={styles['drop']}
      data-disc={props.previewed ? props.board.active : 0}
      aria-hidden="true"
    >
      <span class={`${styles['number']} text textCaption`}>
        {props.column + 1}
      </span>
    </span>
  );
}

/**
 * One column of a disc-drop board: a button that drops the dropping side's
 * disc into it, its cells from bottom to top, and its number above. Pointing
 * at or focusing it previews where the disc would land; a full column stays
 * focusable but refuses the drop and says it is full.
 */
function Column(props: {
  board: DiscDropBoardProps;
  column: number;
  inspecting: boolean;
  /** Drawn as a `GameBoardStage` preview: the discs alone. */
  thumbnail: boolean;
  /** The board's single Tab stop; the other columns are reached by arrows. */
  tabStop: boolean;
  target: number | null;
  preview: (column: number | null) => void;
  focus: (column: number | null, fromKeyboard?: boolean) => void;
  navigate: (event: KeyboardEvent, column: number) => void;
}): JSX.Element {
  const descriptionId = createUniqueId();
  const full = () => landing(props.board, props.column) === null;
  const rows = createMemo(() => {
    const count = props.board.rows;
    return Array.from({ length: count }, (_, n) => count - n - 1);
  });
  const occupied = () =>
    rows().filter(
      (row) => props.board.cells[row * props.board.columns + props.column] !== 0
    ).length;
  const previewed = () =>
    props.target !== null &&
    props.target % props.board.columns === props.column;
  return (
    <>
      <SdkButton
        aria-describedby={descriptionId}
        tabindex={props.tabStop ? 0 : -1}
        aria-keyshortcuts={
          props.inspecting
            ? 'ArrowLeft ArrowRight ArrowUp ArrowDown Escape'
            : props.board.interactive
              ? 'ArrowLeft ArrowRight Home End Enter Space'
              : 'ArrowLeft ArrowRight Home End'
        }
        type="button"
        class={styles['column']}
        data-column={props.column}
        data-testid={props.board.columnTestId(props.column)}
        aria-label={(props.inspecting
          ? (props.board.inspection?.columnLabel ?? props.board.columnLabel)
          : props.board.columnLabel)(props.column, occupied(), full())}
        aria-disabled={ariaBoolean(
          props.inspecting || !props.board.interactive || full()
        )}
        data-full={String(full())}
        data-previewed={String(previewed())}
        onPointerEnter={() => props.preview(props.column)}
        onPointerLeave={() => props.preview(null)}
        onPointerCancel={() => props.preview(null)}
        onFocus={(event) =>
          props.focus(props.column, focusVisible(event.currentTarget))
        }
        onBlur={() => props.focus(null)}
        onKeyDown={(event) => props.navigate(event, props.column)}
        onClick={() => {
          if (!props.inspecting && props.board.interactive && !full())
            props.board.onDrop(props.column);
        }}
      >
        <Show when={!props.thumbnail}>
          <DropMarker
            board={props.board}
            column={props.column}
            previewed={previewed()}
          />
        </Show>
        <For each={rows()}>
          {(row) => (
            <DiscCell
              board={props.board}
              column={props.column}
              row={row}
              target={props.target}
            />
          )}
        </For>
      </SdkButton>
      <span id={descriptionId} class={styles['hidden']}>
        {rows()
          .map((row) =>
            props.board.cellLabel(
              props.column,
              row,
              props.board.cells[row * props.board.columns + props.column] ?? 0
            )
          )
          .join('. ')}
      </span>
    </>
  );
}

function nextColumn(key: string, column: number, count: number): number | null {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return null;
  return key === 'Home'
    ? 0
    : key === 'End'
      ? count - 1
      : (column + (key === 'ArrowRight' ? 1 : count - 1)) % count;
}

/** Whether the browser shows a focus ring here: focus came from the keyboard. */
function focusVisible(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
}
