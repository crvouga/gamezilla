import type {
  ConnectionPort,
  MotionPort,
  MotionSample,
  ScreenshotPort,
} from '@pkgs/feedback-client-ts/ports';
import type { ScreenBox } from '@pkgs/feedback-shared-ts/types';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';

/** The smallest picture a device could take. */
const PICTURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const SHAKE_SAMPLE_MS = 50;
const SHAKE_SAMPLES = 12;

/** Alice's device: what it can see, feel and reach, each set by a scenario. */
export function createExamplePhone(session: Session) {
  let online = true;
  let takesScreenshots = true;
  let asksBeforeMotion = false;
  /** What Alice answered her phone about shaking, once she has. */
  let motionAnswer: boolean | null = null;
  /** Whether Alice is pressing something right now: a phone asks only then. */
  let pressing = false;
  /** The app's askings the phone is still showing Alice. */
  let asking: ((allowed: boolean) => void)[] = [];
  const connectionListeners = new Set<() => void>();
  const motionListeners = new Set<(sample: MotionSample) => void>();
  const screenshotsTakenWhileOpen: boolean[] = [];
  /** What each screenshot taken was asked to mark, `null` for nothing. */
  const marked: (ScreenBox | null)[] = [];
  const screenshot: ScreenshotPort = {
    capture(options) {
      if (!takesScreenshots) return Promise.resolve(null);
      marked.push(options?.highlight ?? null);
      screenshotsTakenWhileOpen.push(
        document.querySelector('[data-testid="bug-report-form"]') !== null
      );
      return Promise.resolve({ contentType: 'image/png', bytes: PICTURE });
    },
  };
  const connection: ConnectionPort = {
    online: () => online,
    subscribe(listener) {
      connectionListeners.add(listener);
      return () => connectionListeners.delete(listener);
    },
  };
  /** The phone as an app just opened finds it: whatever it was asking is put away. */
  const motion = (): MotionPort => {
    asking = [];
    return {
      available: true,
      needsPermission: asksBeforeMotion,
      requestPermission() {
        if (motionAnswer !== null) return Promise.resolve(motionAnswer);
        // No press, no question: the phone has no yes to give.
        if (!pressing) return Promise.resolve(false);
        return new Promise((resolve) => asking.push(resolve));
      },
      subscribe(listener) {
        motionListeners.add(listener);
        return () => motionListeners.delete(listener);
      },
    };
  };
  return {
    screenshot,
    connection,
    motion,
    picture: PICTURE,
    setOnline(next: boolean): void {
      online = next;
      for (const listener of connectionListeners) listener();
    },
    setTakesScreenshots(next: boolean): void {
      takesScreenshots = next;
    },
    setAsksBeforeMotion(next: boolean): void {
      asksBeforeMotion = next;
    },
    /** Alice answers her phone, which remembers it and tells whoever it was asking for. */
    answerMotion(allowed: boolean): void {
      motionAnswer = allowed;
      for (const tell of asking.splice(0)) tell(allowed);
    },
    /** What the phone says about the app noticing shaking. */
    allowsMotion(): 'waiting' | 'allowed' | 'refused' {
      if (!asksBeforeMotion) return 'allowed';
      if (motionAnswer === null) return 'waiting';
      return motionAnswer ? 'allowed' : 'refused';
    },
    /** Something Alice presses: what the app asks the phone meanwhile, the phone asks her. */
    duringPress(act: () => void): void {
      pressing = true;
      try {
        act();
      } finally {
        pressing = false;
      }
    },
    /** What the last screenshot marks: `undefined` when none was taken. */
    lastScreenshotMarks: (): ScreenBox | null | undefined => marked.at(-1),
    /** Whether the last screenshot was taken with the bug report already showing. */
    lastScreenshotShowsBugReport: (): boolean | null =>
      screenshotsTakenWhileOpen.at(-1) ?? null,
    async shake(): Promise<void> {
      for (let sample = 0; sample < SHAKE_SAMPLES; sample++) {
        const x = sample % 2 === 0 ? 30 : -30;
        for (const listener of motionListeners) listener({ x, y: 0, z: 9.8 });
        await session.advanceTime(SHAKE_SAMPLE_MS);
      }
      await session.waitForIdle();
    },
  };
}
