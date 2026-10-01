import type { Clock, Timers } from '@pkgs/clock';
import type { Diagnostic, ReproductionAction, ReproductionRecording } from '../shared/types';
import type { RecordingPort, RecordingState, VideoSession } from './recording-types';

const MAX_ACTIONS = 200;
const MAX_DURATION_MS = 90_000;
const IDLE: RecordingState = { phase: 'idle', recording: null, video: null, notice: null };

export function createReproductionRecorder(options: {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly captureContext: () => Promise<readonly Diagnostic[]>;
  readonly video: RecordingPort | null;
}) {
  let state: RecordingState = IDLE;
  let started = 0;
  let video: VideoSession | null = null;
  let timer: unknown;
  let generation = 0;
  const listeners = new Set<() => void>();
  const publish = (next: RecordingState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const discard = () => {
    generation++;
    options.timers.clearTimeout(timer);
    video?.dispose();
    video = null;
    publish(IDLE);
  };
  const start = async () => {
    discard();
    const current = generation;
    publish({ ...IDLE, phase: 'starting' });
    const capture = options.video?.start().catch(() => null) ?? Promise.resolve(null);
    const initialContext = await options.captureContext();
    const session = await capture;
    if (current !== generation) { session?.dispose(); return; }
    video = session;
    started = options.clock.now();
    publish({ ...IDLE, phase: 'recording', notice: session ? null : 'Video is unavailable. Your reproduction steps are still recording.', recording: {
      version: 1, startedAt: new Date(started).toISOString(), durationMs: 0,
      initialContext, finalContext: [], actions: [], truncated: false,
    } });
    timer = options.timers.setTimeout(() => { void stop(); }, MAX_DURATION_MS);
  };
  const stop = async () => {
    if (state.phase !== 'recording' || !state.recording) return;
    options.timers.clearTimeout(timer);
    const current = generation;
    const recording: ReproductionRecording = { ...state.recording, durationMs: options.clock.now() - started };
    publish({ ...state, phase: 'stopping' });
    const captured = await video?.stop().catch(() => null) ?? null;
    video?.dispose();
    video = null;
    const finalContext = await options.captureContext();
    if (current !== generation) return;
    publish({ ...state, phase: 'ready', video: captured, recording: { ...recording, finalContext } });
  };
  const record = (action: Omit<ReproductionAction, 'atMs'>) => {
    const recording = state.recording;
    if (state.phase !== 'recording' || !recording) return;
    if (recording.actions.length >= MAX_ACTIONS) {
      if (!recording.truncated) publish({ ...state, recording: { ...recording, truncated: true } });
      return;
    }
    publish({ ...state, recording: { ...recording, actions: [...recording.actions, { ...action, atMs: options.clock.now() - started }] } });
  };
  return { start, stop, record, discard, state: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose: discard,
  };
}
