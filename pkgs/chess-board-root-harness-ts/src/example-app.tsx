/** @jsxImportSource solid-js */
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import { createSignal } from 'solid-js';
import type { ExampleConfig } from './example-config';
import {
  createBoardInputs,
  createBoardObservations,
  required,
} from './example-dom';
import { createExampleEvidence } from './example-evidence';
import { attachExampleLayout } from './example-layout';
import { mountExample } from './example-mount';
import { INITIAL } from './positions';
import type { RecordingAudio } from './recording-audio';
import { createRecordingAudio } from './recording-audio';
import type { EarlierCompletionSlot } from './recording-motion';
import { createRecordingMotion } from './recording-motion';

function attachLifecycle(
  session: Session,
  root: HTMLElement,
  dispose: () => void
) {
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    dispose();
    root.remove();
  }
  session.onDispose(close);
  return { close, closed: () => closed };
}
export function createExampleApp(
  session: Session,
  initialConfig: ExampleConfig = {},
  earlierCompletion?: EarlierCompletionSlot,
  suppliedAudio?: RecordingAudio
) {
  const root = document.createElement('div');
  document.body.append(root);
  const [config, setConfig] = createSignal<ExampleConfig>({
    fen: INITIAL,
    size: 320,
    ...initialConfig,
  });
  const audio = suppliedAudio ?? createRecordingAudio();
  const motion = createRecordingMotion({
    clock: session.ports.clock,
    timers: session.ports.timers,
    orientation: () => config().orientation ?? 'white',
    reducedMotion: initialConfig.motionCapabilities?.reducedMotion ?? false,
    lowEnd: initialConfig.motionCapabilities?.lowEnd ?? false,
    webAnimations: initialConfig.motionCapabilities?.webAnimations ?? true,
    ...(earlierCompletion === undefined ? {} : { earlierCompletion }),
  });
  const evidence = createExampleEvidence(session.ports.clock, audio);
  const dispose = mountExample({
    root,
    session,
    config,
    audio,
    motion,
    onMove: evidence.onMove,
    onUserArrowsChange: evidence.onUserArrowsChange,
  });
  const host = required(root, '[data-testid="example-board"]');
  const layout = attachExampleLayout(root, host);
  const lifecycle = attachLifecycle(session, root, dispose);
  return {
    config,
    ...lifecycle,
    host,
    root,
    ...layout,
    userArrowChanges: () =>
      evidence.userArrowChanges.map((arrows) => [...arrows]),
    userArrowSnapshot: evidence.userArrowSnapshot,
    beginArrowObservation: evidence.beginArrowObservation,
    arrowOffers: evidence.arrowOffers,
    keyboardInput: evidence.keyboardInput,
    recordKeyboardInput: evidence.recordKeyboardInput,
    moves: evidence.moves,
    audio,
    motion,
    feedbackReadyAt: evidence.feedbackReadyAt,
    clearEvidence: evidence.clearEvidence,
    ...createBoardInputs({
      host,
      config,
      touched: evidence.touched,
    }),
    ...createBoardObservations({
      host,
      moves: evidence.moves,
      moveRecords: evidence.moveRecords,
      active: motion.active,
      sounds: audio.played,
    }),
    configure(patch: Partial<ExampleConfig>): void {
      setConfig((prev) => ({ ...prev, ...patch }));
    },
    reset(next: ExampleConfig) {
      evidence.clearMoves();
      setConfig({ fen: INITIAL, size: 320, ...next });
    },
  };
}
