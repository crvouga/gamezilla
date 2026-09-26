/** @jsxImportSource solid-js */
/**
 * Chess board harness: one board plus a "parent" that owns its props the way
 * a product screen does (FEN, sync key, orientation, toggles), controls a
 * person can tap to change them, and text logs of what the board emitted
 * (moves, sounds, user arrows). Everything is reachable by test id, so a
 * `@pkgs/ui-testing` driver exercises it without reaching into the DOM.
 */

import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { BoardMotionProvider } from '@pkgs/chess-board/board-motion-context';
import { ChessBoard } from '@pkgs/chess-board/chess-board';
import type { BoardArrow, Move } from '@pkgs/chess-board/chess-board-types';
import { ClockProvider, useClock, useTimers } from '@pkgs/clock/solid';
import type { Clock, Timers } from '@pkgs/clock/types';
import { AudioPlaybackProvider } from '@pkgs/sounds/solid';
import { ThemeProvider } from '@pkgs/ui';
import { Chess } from 'chess.js';
import {
  createEffect,
  createSignal,
  For,
  type JSX,
  Show,
  untrack,
} from 'solid-js';

import {
  HARNESS_BOARD_TEST_ID,
  type HarnessConfig,
  HarnessIds,
  type HarnessToggle,
} from './harness-config';
import { createRecordingAudio } from './recording-audio';
import { createRecordingMotion } from './recording-motion';

const FRAME_WIDTH_PX = 360;
const DEFAULT_SIZE_PX = 320;

const TOGGLE_DEFAULTS: Readonly<Record<HarnessToggle, boolean>> = {
  interactive: true,
  premoves: false,
  animations: true,
  showCoordinates: true,
  highlightLastMove: true,
  highlightLegalMoves: true,
  enableUserArrows: false,
  autoPromoteQueen: false,
  reducedMotion: false,
};

const TOGGLES = Object.keys(TOGGLE_DEFAULTS) as HarnessToggle[];

function initialToggles(config: HarnessConfig): Record<HarnessToggle, boolean> {
  const out = { ...TOGGLE_DEFAULTS };
  for (const name of TOGGLES) out[name] = config[name] ?? out[name];
  return out;
}

function moveRecord(m: Move): Record<string, unknown> {
  return {
    from: m.from,
    to: m.to,
    san: m.san ?? null,
    promotion: m.promotion ?? null,
    captured: m.captured ?? null,
  };
}

/** Parent-side FEN after applying `m` (a real screen's game state). */
function applyOnParent(fen: string | undefined, m: Move): string {
  const chess = new Chess(fen);
  chess.move({
    from: m.from,
    to: m.to,
    ...(m.promotion ? { promotion: m.promotion } : {}),
  });
  return chess.fen();
}

function createHarnessState(config: HarnessConfig) {
  const [fen, setFen] = createSignal(config.fen);
  const [syncKey, setSyncKey] = createSignal(0);
  const [orientation, setOrientation] = createSignal(
    config.orientation ?? 'white'
  );
  const [toggles, setToggles] = createSignal(initialToggles(config));
  const [arrowsOn, setArrowsOn] = createSignal(true);
  const [scriptAt, setScriptAt] = createSignal(0);
  const [moves, setMoves] = createSignal<readonly Move[]>([]);
  const [userArrows, setUserArrows] = createSignal<readonly BoardArrow[]>([]);
  const [mountKey, setMountKey] = createSignal(1);
  const [mounted, setMounted] = createSignal(true);
  return {
    fen,
    syncKey,
    orientation,
    toggles,
    arrowsOn,
    moves,
    userArrows,
    mountKey,
    mounted,
    onMove(m: Move): void {
      setMoves((prev) => [...prev, m]);
      if (config.parent === 'confirm') setFen(applyOnParent(fen(), m));
    },
    onUserArrowsChange: setUserArrows,
    next(): void {
      const next = config.script?.[scriptAt()];
      if (next === undefined) return;
      setScriptAt((i) => i + 1);
      setFen(next);
    },
    reject: () => setSyncKey((k) => k + 1),
    flip: () => setOrientation((o) => (o === 'white' ? 'black' : 'white')),
    toggle: (name: HarnessToggle) =>
      setToggles((t) => ({ ...t, [name]: !t[name] })),
    toggleArrows: () => setArrowsOn((on) => !on),
    remount(): void {
      setMounted(true);
      setMountKey((k) => k + 1);
    },
    unmount: () => setMounted(false),
  };
}

type HarnessState = ReturnType<typeof createHarnessState>;

function HarnessBoard(props: {
  readonly config: HarnessConfig;
  readonly state: HarnessState;
}): JSX.Element {
  const t = () => props.state.toggles();
  const size = () =>
    props.config.size === null
      ? undefined
      : (props.config.size ?? DEFAULT_SIZE_PX);
  const shared = {
    get orientation() {
      return props.state.orientation();
    },
    get size() {
      return size();
    },
    get showCoordinates() {
      return t().showCoordinates;
    },
    get highlightLastMove() {
      return t().highlightLastMove;
    },
    get highlightLegalMoves() {
      return t().highlightLegalMoves;
    },
    get arrows() {
      return props.state.arrowsOn() ? props.config.arrows : undefined;
    },
    get enableUserArrows() {
      return t().enableUserArrows;
    },
    get premoves() {
      return t().premoves;
    },
    get autoPromoteQueen() {
      return t().autoPromoteQueen;
    },
    get dataSet() {
      return { testid: props.config.testId ?? HARNESS_BOARD_TEST_ID };
    },
    get cellFeedback() {
      return props.config.cellFeedback;
    },
    get cellHighlights() {
      return props.config.cellHighlights;
    },
    onMove: (m: Move) => props.state.onMove(m),
    onUserArrowsChange: (a: readonly BoardArrow[]) =>
      props.state.onUserArrowsChange(a),
  };
  return (
    <ChessBoard
      {...shared}
      fen={props.state.fen()}
      fenSyncKey={props.state.syncKey()}
      interactive={t().interactive}
      animations={t().animations}
      animationDurationMs={props.config.animationDurationMs}
    />
  );
}

function ControlButton(props: {
  readonly testId: string;
  readonly label: string;
  readonly onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      data-testid={props.testId}
      onClick={() => props.onClick()}
    >
      {props.label}
    </button>
  );
}

function HarnessControls(props: { readonly state: HarnessState }): JSX.Element {
  return (
    <div class="flex flex-wrap gap-1">
      <ControlButton
        testId={HarnessIds.next}
        label="Next"
        onClick={() => props.state.next()}
      />
      <ControlButton
        testId={HarnessIds.reject}
        label="Reject"
        onClick={() => props.state.reject()}
      />
      <ControlButton
        testId={HarnessIds.flip}
        label="Flip"
        onClick={() => props.state.flip()}
      />
      <ControlButton
        testId={HarnessIds.remount}
        label="Remount"
        onClick={() => props.state.remount()}
      />
      <ControlButton
        testId={HarnessIds.unmount}
        label="Unmount"
        onClick={() => props.state.unmount()}
      />
      <ControlButton
        testId={HarnessIds.toggleArrows}
        label="Arrows"
        onClick={() => props.state.toggleArrows()}
      />
      <For each={TOGGLES}>
        {(name) => (
          <ControlButton
            testId={HarnessIds.toggle(name)}
            label={name}
            onClick={() => props.state.toggle(name)}
          />
        )}
      </For>
    </div>
  );
}

function HarnessLogs(props: {
  readonly state: HarnessState;
  readonly sounds: () => readonly string[];
  readonly slides: () => readonly string[];
}): JSX.Element {
  return (
    <div>
      <pre data-testid={HarnessIds.moves}>
        {JSON.stringify(props.state.moves().map(moveRecord))}
      </pre>
      <pre data-testid={HarnessIds.sounds}>
        {JSON.stringify(props.sounds())}
      </pre>
      <pre data-testid={HarnessIds.userArrows}>
        {JSON.stringify(props.state.userArrows())}
      </pre>
      <pre data-testid={HarnessIds.parentFen}>{props.state.fen() ?? ''}</pre>
      <pre data-testid={HarnessIds.slides}>
        {JSON.stringify(props.slides())}
      </pre>
    </div>
  );
}

/** Harness screen: frame + board, controls, logs. */
export function ChessBoardHarness(props: {
  readonly config: HarnessConfig;
}): JSX.Element {
  const audio = createRecordingAudio();
  // A scenario's config is fixed for the life of the page.
  const config = untrack(() => props.config);
  const state = createHarnessState(config);
  const motion = createRecordingMotion({
    clock: useClock(),
    timers: useTimers(),
    orientation: state.orientation,
    reducedMotion: config.reducedMotion === true,
    lowEnd: config.lowEnd === true,
    webAnimations: config.webAnimations !== false,
  });
  createEffect(() => motion.setReducedMotion(state.toggles().reducedMotion));
  return (
    <BoardMotionProvider value={motion.env}>
      <AudioPlaybackProvider value={audio.port}>
        <div data-testid={HarnessIds.root} class="flex flex-col gap-2 p-2">
          <div
            data-testid={HarnessIds.frame}
            style={{ width: `${props.config.frameWidth ?? FRAME_WIDTH_PX}px` }}
          >
            <Show when={state.mounted() ? state.mountKey() : false} keyed>
              <HarnessBoard config={props.config} state={state} />
            </Show>
          </div>
          <HarnessControls state={state} />
          <HarnessLogs
            state={state}
            sounds={audio.played}
            slides={motion.slides}
          />
        </div>
      </AudioPlaybackProvider>
    </BoardMotionProvider>
  );
}

/** Lingui + clock + theme around the harness; each host injects its clock. */
export function ChessBoardHarnessApp(props: {
  readonly config: HarnessConfig;
  readonly clock: Clock;
  readonly timers: Timers;
}): JSX.Element {
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  return (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={props.clock} timers={props.timers}>
        <ThemeProvider colorScheme="light">
          <ChessBoardHarness config={props.config} />
        </ThemeProvider>
      </ClockProvider>
    </I18nProvider>
  );
}
