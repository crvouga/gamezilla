/** @jsxImportSource solid-js */
/**
 * Repeatable board perf page: scripted drag timing, 200-ply FEN scrub, and a
 * 20-board mount. Uses injected {@link useClock} / {@link useTimers}.
 */

import type { Clock, Timers } from '@pkgs/clock';
import { useClock, useTimers } from '@pkgs/clock/solid';
import { type JSX, createSignal, For, Show } from 'solid-js';

import { SmartChessBoard } from '../smart-chess-board';
import {
  BOARD_PERF_BUDGETS,
  generatePlyFens,
  measureSync,
} from './chess-board-bench';

export type BenchResultLine = {
  readonly label: string;
  readonly detail: string;
};

type PushLine = (label: string, detail: string) => void;

function formatMs(n: number): string {
  return `${n.toFixed(2)}ms`;
}

/** Cheap work so drag-sim measureSync is not a pure no-op. */
const DRAG_SIM_WORK = 64 * 100;

function runDragSim(clock: Clock, pushLine: PushLine): void {
  const measure = measureSync(
    () => {
      void DRAG_SIM_WORK;
    },
    120,
    clock.now
  );
  pushLine(
    'Run drag sim',
    `mean ${formatMs(measure.meanMs)} max ${formatMs(measure.maxMs)} (budget frame ${formatMs(BOARD_PERF_BUDGETS.frameBudgetMs)})`
  );
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
  readonly onDragSim: () => void;
  readonly onScrub: () => void;
  readonly onMountTwenty: () => void;
  readonly onReset: () => void;
}): JSX.Element {
  return (
    <div class="flex flex-wrap gap-2">
      <button type="button" onClick={props.onDragSim}>
        Run drag sim
      </button>
      <button type="button" onClick={props.onScrub}>
        Scrub 200 plies
      </button>
      <button type="button" onClick={props.onMountTwenty}>
        Mount 20 boards
      </button>
      <button type="button" onClick={props.onReset}>
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
        onDragSim={() => runDragSim(clock, pushLine)}
        onScrub={() => scrubPlies(clock, timers, setFen, pushLine)}
        onMountTwenty={() => mountTwenty(clock, setBoardCount, pushLine)}
        onReset={() => {
          setBoardCount(1);
          setFen(undefined);
          setLines([]);
        }}
      />
      <p class="text-sm opacity-80">
        Budgets: mount {BOARD_PERF_BUDGETS.mountScriptingMs}ms, INP{' '}
        {BOARD_PERF_BUDGETS.inpMs}ms, long task {BOARD_PERF_BUDGETS.longTaskMs}
        ms.
      </p>
      <div class="flex flex-wrap gap-2">
        <For each={[...Array(boardCount()).keys()]}>
          {() => (
            <SmartChessBoard
              size={160}
              fen={fen()}
              animations={false}
              interactive={false}
            />
          )}
        </For>
      </div>
      <Show when={lines().length > 0}>
        <ul class="text-sm">
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
