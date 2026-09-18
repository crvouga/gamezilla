export interface CheckHealStep {
  readonly stepId: string;
  readonly bunScript: string;
}

/** The check surface is exactly `bun run check` — one step. */
export const CHECK_HEAL_STEPS: ReadonlyArray<CheckHealStep> = [
  { stepId: 'check', bunScript: 'check' },
];
