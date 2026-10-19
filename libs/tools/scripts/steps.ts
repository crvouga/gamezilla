export interface VerifyHealStep {
  readonly stepId: string;
  readonly bunScript: string;
}

/** The verification surface is exactly `bun verify` — one step, run here so its output can be captured. */
export const VERIFY_HEAL_STEPS: ReadonlyArray<VerifyHealStep> = [
  { stepId: 'verify', bunScript: 'verify' },
];
