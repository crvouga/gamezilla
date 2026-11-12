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
 * Shake to report is the person's own choice: on unless they turned it `off`.
 * While it is on, `on` means a shake opens a bug report; `needs-permission`
 * that the phone asks the person first and has no answer yet; `refused` that
 * the person, or the phone, said no.
 */
export type ShakeState =
  | 'on'
  | 'off'
  | 'needs-permission'
  | 'refused'
  | 'unavailable';

type PhoneAnswer = 'allowed' | 'waiting' | 'refused';

/** Shake to report: on unless the person turns it off, wherever the phone allows it. */
export class ShakeControl {
  private started = false;
  /** The person's choice, which no answer of the phone changes. */
  private wanted = true;
  private phone: PhoneAnswer = 'waiting';
  private stop: (() => void) | null = null;
  private disposed = false;
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

  readonly state = (): ShakeState => {
    if (!this.started) return 'unavailable';
    if (!this.wanted) return 'off';
    if (this.phone === 'allowed') return 'on';
    return this.phone === 'refused' ? 'refused' : 'needs-permission';
  };

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private allowed(): Promise<boolean> {
    return this.options.motion.requestPermission().catch(() => false);
  }

  /** Feels for a shake exactly while the person wants it and the phone allows it. */
  private sync(): void {
    const feel = this.wanted && this.phone === 'allowed' && !this.disposed;
    if (feel && this.stop === null) {
      const shaken = createShakeDetector(this.options.clock);
      this.stop = this.options.motion.subscribe((sample) => {
        if (shaken(sample)) this.options.onShake();
      });
    } else if (!feel) {
      this.stop?.();
      this.stop = null;
    }
    for (const listener of this.listeners) listener();
  }

  private async start(): Promise<void> {
    const { motion, storage } = this.options;
    if (!motion.available) return;
    const preference = await storage.shakePreference();
    this.wanted = preference !== 'off';
    // A person who allowed it before is not asked again where the phone remembers.
    if (!motion.needsPermission) this.phone = 'allowed';
    else if (preference === 'on' && (await this.allowed()))
      this.phone = 'allowed';
    this.started = true;
    this.sync();
  }

  /**
   * Takes the phone's answer. Asked before anything is awaited, while the
   * press still counts as the person's: a phone only asks then.
   */
  private async ask(): Promise<void> {
    const { motion, storage } = this.options;
    if (!motion.available) return;
    const answer =
      motion.needsPermission && this.phone !== 'allowed'
        ? this.allowed()
        : Promise.resolve(true);
    await this.ready;
    this.phone = (await answer) ? 'allowed' : 'refused';
    // Kept, so the phone's yes is found again when the app is reopened.
    if (this.wanted && this.phone === 'allowed')
      await storage.setShakePreference('on');
    this.sync();
  }

  /** Call from the person's own press. Has the phone ask the person, and nothing else. */
  readonly allow = (): Promise<void> => this.ask();

  /** Call from the person's own press. It is on from here, whatever the phone then answers. */
  readonly turnOn = async (): Promise<void> => {
    if (!this.options.motion.available) return;
    const asked = this.ask();
    await this.ready;
    this.wanted = true;
    this.sync();
    await this.options.storage.setShakePreference('on');
    await asked;
  };

  readonly turnOff = async (): Promise<void> => {
    await this.ready;
    if (!this.options.motion.available) return;
    this.wanted = false;
    this.sync();
    await this.options.storage.setShakePreference('off');
  };

  dispose(): void {
    this.disposed = true;
    this.stop?.();
    this.stop = null;
    this.listeners.clear();
  }
}
