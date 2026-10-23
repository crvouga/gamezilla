/** Keep the existing two-phase ceiling; permit a caller to lower it. */
export async function runVerifyPhaseGroup<P, T>(
  phases: readonly P[],
  runPhase: (phase: P) => Promise<T | undefined>,
  configured: string | undefined
): Promise<T | undefined> {
  const count = Number(configured);
  const limit = Number.isInteger(count) && count > 0 ? Math.min(2, count) : 2;
  let next = 0;
  let failure: T | undefined;
  const worker = async () => {
    while (failure === undefined) {
      const phase = phases[next++];
      if (phase === undefined) return;
      const result = await runPhase(phase);
      if (result !== undefined) failure ??= result;
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, phases.length) }, worker)
  );
  return failure;
}
