/** The process must terminate even when draining or flushing telemetry fails. */
export async function shutdownSyntheticPopulationWorker(
  drain: () => Promise<void>,
  flush: () => Promise<void>,
  finish: (code: number) => void
): Promise<void> {
  let code = 0;
  try {
    await drain();
  } catch {
    code = 1;
  }
  try {
    await flush();
  } catch {
    code = 1;
  } finally {
    finish(code);
  }
}
