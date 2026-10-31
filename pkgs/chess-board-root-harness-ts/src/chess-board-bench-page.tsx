/** @jsxImportSource solid-js */
/**
 * Board perf page: a 200-ply FEN scrub (every ply slides) and a 20-board
 * mount. Uses injected {@link useClock} / {@link useTimers}.
 */

import { ChessBoard } from '@pkgs/chess-board-root-client-ts/chess-board';
import {
  BOARD_PERF_BUDGETS,
  generatePlyFens,
  measureSync,
} from '@pkgs/chess-board-root-shared-ts/chess-board-bench';
import { useClock, useTimers } from '@pkgs/clock-client-ts/solid';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import { createSignal, For, type JSX, Show } from 'solid-js';

export type BenchResultLine = {
  readonly label: string;
  readonly detail: string;
};

type PushLine = (label: string, detail: string) => void;

function formatMs(n: number): string {
  return `${n.toFixed(2)}ms`;
}

function scrubPlies(
  clock: Clock,
  timers: Timers,
  setFen: (fen: string | undefined) => void,
  pushLine: PushLine
): void {
  const fens = generatePlyFens(200);
  let i = 0;
  const t0 = clock.now();
  const step = (): void => {
    if (i >= fens.length) {
      pushLine(
        'Scrub 200 plies',
        `${fens.length} FENs in ${formatMs(clock.now() - t0)} (long-task budget ${BOARD_PERF_BUDGETS.longTaskMs}ms)`
      );
      return;
    }
    setFen(fens[i]);
    i += 1;
    timers.setTimeout(step, 0);
  };
  step();
}

function mountTwenty(
  clock: Clock,
  setBoardCount: (n: number) => void,
  pushLine: PushLine
): void {
  const measure = measureSync(
    () => {
      setBoardCount(20);
    },
    1,
    clock.now
  );
  pushLine(
    'Mount 20 boards',
    `setState ${formatMs(measure.totalMs)} (mount budget ${BOARD_PERF_BUDGETS.mountScriptingMs}ms)`
  );
}

function BenchToolbar(props: {
  readonly onScrub: () => void;
  readonly onMountTwenty: () => void;
  readonly onReset: () => void;
}): JSX.Element {
  return (
    <div class="flex flex-wrap gap-2">
      <button type="button" onClick={() => props.onScrub()}>
        Scrub 200 plies
      </button>
      <button type="button" onClick={() => props.onMountTwenty()}>
        Mount 20 boards
      </button>
      <button type="button" onClick={() => props.onReset()}>
        Reset
      </button>
    </div>
  );
}

export function ChessBoardBenchPage(): JSX.Element {
  const clock = useClock();
  const timers = useTimers();
  const [fen, setFen] = createSignal<string | undefined>(undefined);
  const [boardCount, setBoardCount] = createSignal(1);
  const [lines, setLines] = createSignal<readonly BenchResultLine[]>([]);
  const pushLine: PushLine = (label, detail) => {
    setLines((prev) => [...prev, { label, detail }]);
  };

  return (
    <div data-component="ChessBoardBenchPage" class="flex flex-col gap-3 p-3">
      <BenchToolbar
        onScrub={() => scrubPlies(clock, timers, setFen, pushLine)}
        onMountTwenty={() => mountTwenty(clock, setBoardCount, pushLine)}
        onReset={() => {
          setBoardCount(1);
          setFen(undefined);
          setLines([]);
        }}
      />
      <p class="text textCaption">
        Budgets: mount {BOARD_PERF_BUDGETS.mountScriptingMs}ms, INP{' '}
        {BOARD_PERF_BUDGETS.inpMs}ms, long task {BOARD_PERF_BUDGETS.longTaskMs}
        ms.
      </p>
      <div class="flex flex-wrap gap-2">
        <For each={[...Array(boardCount()).keys()]}>
          {() => (
            <ChessBoard
              size={160}
              fen={fen()}
              interactive={false}
              sound={false}
            />
          )}
        </For>
      </div>
      <Show when={lines().length > 0}>
        <ul class="text textCaption">
          <For each={[...lines()]}>
            {(line) => (
              <li>
                {line.label}: {line.detail}
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
