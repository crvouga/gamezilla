/** The four directions a rider can face, in clockwise order. */
export type TrailHeading = 'up' | 'right' | 'down' | 'left';

/** A rider's seat in the arena; each index has its own colour and trail pattern. */
export type TrailRiderIndex = 0 | 1 | 2 | 3;

/**
 * A locally controlled rider, counted in rider order among the controlled
 * ones: slot 0 steers with the arrow keys, slot 1 with WASD.
 */
export type TrailSlot = 0 | 1;

export type TrailRider = {
  readonly index: TrailRiderIndex;
  /** Head cell, column from the left. */
  readonly x: number;
  /** Head cell, row from the top. */
  readonly y: number;
  readonly heading: TrailHeading;
  /** The direction of its next step when a turn is waiting; the heading otherwise. */
  readonly next?: TrailHeading | undefined;
  readonly alive: boolean;
  /** One letter drawn on the head. */
  readonly mark: string;
  /** Steered from this device. */
  readonly controlled: boolean;
  /** The rider's name, shown as the head's tooltip. */
  readonly label: string;
};

export type TrailCrash = {
  readonly index: TrailRiderIndex;
  readonly x: number;
  readonly y: number;
};

/** A centred banner over the arena: a countdown number, a round, a result. */
export type TrailOverlay = {
  readonly title: string;
  readonly detail?: string | undefined;
};

export type TrailControls = {
  readonly riders: readonly TrailRider[];
  readonly enabled: boolean;
  readonly onDirection: (heading: TrailHeading, rider: TrailSlot) => void;
};

export type TrailArenaProps = TrailControls & {
  /** Columns of cells. */
  readonly width: number;
  /** Rows of cells. */
  readonly height: number;
  /**
   * Row-major, `width * height` characters: `.` is empty, `0`–`3` is a
   * trail cell owned by that rider index.
   */
  readonly cells: string;
  readonly crashes: readonly TrailCrash[];
  readonly overlay?: TrailOverlay | undefined;
  readonly label: string;
  readonly instructionsId: string;
  readonly testId: string;
};

export const TRAIL_RIDER_INDICES: readonly TrailRiderIndex[] = [0, 1, 2, 3];
