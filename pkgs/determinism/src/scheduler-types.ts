export type SimTask = () => void | Promise<void>;

export type Queued = {
  readonly at: number;
  readonly seq: number;
  readonly run: SimTask;
};
