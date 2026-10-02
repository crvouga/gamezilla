import type { WorkerState } from './worker-state';

export type RetirementResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

/** Wrangler can delete a Worker and then fail its optional legacy asset cleanup. */
export async function retireWorker(
  name: string,
  remove: (name: string) => RetirementResult | Promise<RetirementResult>,
  state: Pick<WorkerState, 'scriptExists'>
): Promise<RetirementResult> {
  const result = await remove(name);
  if (await state.scriptExists(name))
    throw new Error(
      `Retirement of ${name} failed; Worker still exists. ${result.stderr}`
    );
  return result;
}
