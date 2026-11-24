/** One user-intent driver op, as a recorder sees it. */
export type StepMeta = {
  readonly kind: 'ui' | 'expect';
  /** What the op does: `tap`, `input "a@b.c"`, `expect visible`, …. */
  readonly title: string;
  /** The op's target, as a test-id path (`testId("modal") >> testId("ok")`). */
  readonly selector: string;
  readonly detail?: string;
};

/** Receives every op of a {@link recordingDriver} and runs it. */
export type StepRecorder = {
  record<T>(meta: StepMeta, fn: () => Promise<T>): Promise<T>;
};
