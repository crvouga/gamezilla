import type { ScreenshotFile } from '@pkgs/feedback-shared-ts/types';

/** Takes a picture of what the app is showing; `null` when the device cannot. */
export type ScreenshotPort = {
  capture(): Promise<ScreenshotFile | null>;
};

export type ConnectionPort = {
  online(): boolean;
  /** Told whenever the device goes offline or comes back. */
  subscribe(listener: () => void): () => void;
};

/** Acceleration including gravity, in m/s². */
export type MotionSample = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type MotionPort = {
  /** A phone or tablet that can feel being shaken. */
  readonly available: boolean;
  /** The device asks the person before an app may notice motion. */
  readonly needsPermission: boolean;
  /** Asks only when a person just acted; otherwise answers what was already decided. */
  requestPermission(): Promise<boolean>;
  subscribe(listener: (sample: MotionSample) => void): () => void;
};
