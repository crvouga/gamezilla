/** The body of a Task: runs when the Scheduler fires the Task. */
export type TaskBody = () => void | Promise<void>;

/** A schedulable unit of work: due time, stable id, label, body. */
export type Task = {
  readonly at: number;
  readonly id: number;
  readonly run: TaskBody;
  readonly label: string;
};

/** A Task started by the drain that has not yet settled. */
export type InFlightTask = {
  readonly taskId: number;
  readonly label: string;
  settled: boolean;
  error: unknown;
  readonly promise: Promise<void>;
};
