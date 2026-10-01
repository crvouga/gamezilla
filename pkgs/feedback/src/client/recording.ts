import type { Clock, Timers } from '@pkgs/clock';
import type {
  Diagnostic,
  ReproductionAction,
  ReproductionRecording,
} from '../shared/types';
import type {
  RecordingPort,
  RecordingState,
  VideoSession,
} from './recording-types';

type RecordingOptions = {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly captureContext: () => Promise<readonly Diagnostic[]>;
  readonly video: RecordingPort | null;
};
const IDLE: RecordingState = {
  phase: 'idle',
  recording: null,
  video: null,
  notice: null,
};

class ReproductionRecorder {
  private current: RecordingState = IDLE;
  private started = 0;
  private video: VideoSession | null = null;
  private readonly sessions = new Set<VideoSession>();
  private timer: unknown;
  private generation = 0;
  private actionBytes = 0;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly options: RecordingOptions) {}

  state = (): RecordingState => this.current;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: RecordingState): void {
    this.current = next;
    for (const listener of this.listeners) listener();
  }
  discard = (): void => {
    this.generation++;
    this.options.timers.clearTimeout(this.timer);
    for (const session of this.sessions) session.dispose();
    this.sessions.clear();
    this.video = null;
    this.actionBytes = 0;
    this.publish(IDLE);
  };
  start = async (): Promise<void> => {
    this.discard();
    const generation = this.generation;
    this.publish({ ...IDLE, phase: 'starting' });
    const capture =
      this.options.video?.start().catch(() => null) ?? Promise.resolve(null);
    const session = await capture;
    if (generation !== this.generation) {
      session?.dispose();
      return;
    }
    this.video = session;
    if (session) this.sessions.add(session);
    const initialContext = await this.options.captureContext();
    if (generation !== this.generation) return;
    this.started = this.options.clock.now();
    this.publish({
      ...IDLE,
      phase: 'recording',
      notice: session
        ? null
        : 'Video is unavailable. Your reproduction steps are still recording.',
      recording: {
        version: 1,
        startedAt: new Date(this.started).toISOString(),
        durationMs: 0,
        initialContext,
        finalContext: [],
        actions: [],
        truncated: false,
      },
    });
    this.timer = this.options.timers.setTimeout(() => {
      void this.stop();
    }, 90_000);
  };
  stop = async (): Promise<void> => {
    if (this.current.phase !== 'recording' || !this.current.recording) return;
    this.options.timers.clearTimeout(this.timer);
    const generation = this.generation;
    const recording: ReproductionRecording = {
      ...this.current.recording,
      durationMs: this.elapsed(),
    };
    this.publish({ ...this.current, phase: 'stopping' });
    const session = this.video;
    this.video = null;
    const captured = await this.finishVideo(session);
    session?.dispose();
    if (session) this.sessions.delete(session);
    const finalContext = await this.options.captureContext();
    if (generation !== this.generation) return;
    this.publish({
      ...this.current,
      phase: 'ready',
      video: captured,
      notice:
        session && !captured
          ? 'Video could not be kept. Your reproduction steps are ready to review.'
          : this.current.notice,
      recording: { ...recording, finalContext },
    });
  };
  private elapsed(): number {
    return Math.max(
      0,
      Math.min(90_000, this.options.clock.now() - this.started)
    );
  }
  private async finishVideo(session: VideoSession | null) {
    if (!session) return null;
    let handle: unknown;
    try {
      return await Promise.race([
        session.stop(),
        new Promise<never>((_, reject) => {
          handle = this.options.timers.setTimeout(
            () => reject(new Error('Video unavailable')),
            3500
          );
        }),
      ]);
    } catch {
      return null;
    } finally {
      this.options.timers.clearTimeout(handle);
    }
  }
  record = (action: Omit<ReproductionAction, 'atMs'>): void => {
    const recording = this.current.recording;
    if (this.current.phase !== 'recording' || !recording) return;
    const captured = {
      ...action,
      atMs: this.elapsed(),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(captured)).byteLength;
    if (recording.actions.length >= 200 || this.actionBytes + bytes > 32_000) {
      if (!recording.truncated)
        this.publish({
          ...this.current,
          recording: { ...recording, truncated: true },
        });
      return;
    }
    this.actionBytes += bytes;
    this.publish({
      ...this.current,
      recording: { ...recording, actions: [...recording.actions, captured] },
    });
  };
  restore(recording: ReproductionRecording | null, video: import('../shared/types').EvidenceFile | null): void {
    this.discard();
    if (recording) this.publish({ ...IDLE, phase: 'ready', recording, video });
  }
  dispose = this.discard;
}
export function createReproductionRecorder(options: RecordingOptions) {
  return new ReproductionRecorder(options);
}
