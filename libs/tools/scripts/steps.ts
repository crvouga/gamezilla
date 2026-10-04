export interface CheckHealStep {
  readonly stepId: string;
  readonly bunScript: string;
}

/** The check surface is exactly `bun run check:local` — one step, run here so its output can be captured. */
export const CHECK_HEAL_STEPS: ReadonlyArray<CheckHealStep> = [
  { stepId: 'check', bunScript: 'check:local' },
];
