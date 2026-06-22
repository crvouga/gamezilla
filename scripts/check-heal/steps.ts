export interface CheckHealStep {
  readonly stepId: string;
  readonly bunScript: string;
  readonly env?: Readonly<Record<string, string>>;
}

/** Mirrors `bun check` = `check:static` + `check:ci`. */
export const CHECK_HEAL_STEPS: ReadonlyArray<CheckHealStep> = [
  { stepId: 'static', bunScript: 'check:static' },
  {
    stepId: 'ci',
    bunScript: 'check:ci',
    env: { TURBO_OUTPUT_LOGS: 'errors-only' },
  },
];
