import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { MotionPort, MotionSample } from './ports';
import type { BugReportStorage } from './storage';

/** Above this, in m/s² including gravity, a phone is being moved hard. */
const HARD_MOTION = 13;
const WINDOW_MS = 500;
const MIN_SPAN_MS = 250;
const COOLDOWN_MS = 2000;

/**
 * Tells a deliberate shake from a phone being carried, set down or dropped:
 * three quarters of half a second must be hard motion. One knock is not.
 */
export function createShakeDetector(
  clock: Clock
): (sample: MotionSample) => boolean {
  let recent: { at: number; hard: boolean }[] = [];
  let quietUntil = 0;
  return (sample) => {
    const at = clock.now();
    if (at < quietUntil) return false;
    recent.push({
      at,
      hard: Math.hypot(sample.x, sample.y, sample.z) > HARD_MOTION,
    });
    recent = recent.filter((entry) => entry.at > at - WINDOW_MS);
    const span = at - (recent[0]?.at ?? at);
    const hard = recent.filter((entry) => entry.hard).length;
    if (span < MIN_SPAN_MS || hard * 4 < recent.length * 3) return false;
    recent = [];
    quietUntil = at + COOLDOWN_MS;
    return true;
  };
}

/**
 * `needs-permission`: the phone asks the person first, and has not yet.
 * `refused`: the person, or the phone, said no.
 */
export type ShakeState =
  | 'on'
  | 'off'
  | 'needs-permission'
  | 'refused'
  | 'unavailable';

/** Shake to report: on wherever the phone allows it without asking. */
export class ShakeControl {
  private current: ShakeState = 'unavailable';
  private stop: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();
  readonly ready: Promise<void>;

  constructor(
    private readonly options: {
      readonly motion: MotionPort;
      readonly storage: BugReportStorage;
      readonly clock: Clock;
      readonly onShake: () => void;
    }
  ) {
    this.ready = this.start().catch(() => undefined);
  }

  readonly state = (): ShakeState => this.current;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(state: ShakeState): void {
    this.current = state;
    for (const listener of this.listeners) listener();
  }

  private allowed(): Promise<boolean> {
    return this.options.motion.requestPermission().catch(() => false);
  }

  private listen(): void {
    this.stop?.();
    const shaken = createShakeDetector(this.options.clock);
    this.stop = this.options.motion.subscribe((sample) => {
      if (shaken(sample)) this.options.onShake();
    });
    this.set('on');
  }

  private async start(): Promise<void> {
    const { motion, storage } = this.options;
    if (!motion.available) return;
    const preference = await storage.shakePreference();
    if (preference === 'off') {
      this.set('off');
      return;
    }
    if (!motion.needsPermission) {
      this.listen();
      return;
    }
    // A person who allowed it before is not asked again where the phone remembers.
    if (preference === 'on' && (await this.allowed())) {
      this.listen();
      return;
    }
    this.set('needs-permission');
  }

  /** Call from the person's own press: a phone only asks then. */
  readonly turnOn = async (): Promise<void> => {
    const { motion, storage } = this.options;
    if (!motion.available) return;
    // Asked before anything is awaited, while the press still counts as the person's.
    const allowed = motion.needsPermission
      ? this.allowed()
      : Promise.resolve(true);
    await this.ready;
    if (!(await allowed)) {
      this.set('refused');
      return;
    }
    await storage.setShakePreference('on');
    this.listen();
  };

  readonly turnOff = async (): Promise<void> => {
    await this.ready;
    if (!this.options.motion.available) return;
    this.stop?.();
    this.stop = null;
    await this.options.storage.setShakePreference('off');
    this.set('off');
  };

  dispose(): void {
    this.stop?.();
    this.listeners.clear();
  }
}
