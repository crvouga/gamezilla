import type {
  ConnectionPort,
  MotionPort,
  MotionSample,
  ScreenshotPort,
} from '@pkgs/feedback-client-ts/ports';
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
  let allowsMotion = true;
  let motionDecision: boolean | null = null;
  const connectionListeners = new Set<() => void>();
  const motionListeners = new Set<(sample: MotionSample) => void>();
  const screenshotsTakenWhileOpen: boolean[] = [];
  const screenshot: ScreenshotPort = {
    capture() {
      if (!takesScreenshots) return Promise.resolve(null);
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
  const motion = (): MotionPort => ({
    available: true,
    needsPermission: asksBeforeMotion,
    requestPermission() {
      motionDecision ??= allowsMotion;
      return Promise.resolve(motionDecision);
    },
    subscribe(listener) {
      motionListeners.add(listener);
      return () => motionListeners.delete(listener);
    },
  });
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
    setAllowsMotion(next: boolean): void {
      allowsMotion = next;
    },
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
