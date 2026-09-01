export type SimTask = () => void | Promise<void>;

export type Queued = {
  readonly at: number;
  readonly seq: number;
  readonly run: SimTask;
  readonly label: string;
};

/** A task started by the drain that has not yet settled. */
export type InFlightTask = {
  readonly taskId: number;
  readonly label: string;
  settled: boolean;
  error: unknown;
  readonly promise: Promise<void>;
};
