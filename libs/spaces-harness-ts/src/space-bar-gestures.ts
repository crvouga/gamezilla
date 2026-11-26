import type { HarnessActor } from '@libs/harness-ts/harness';

/** Closing the outcome returns the person to the final board and its space bar. */
export async function dismissGameResult(
  ui: HarnessActor['ui'],
  timeoutMs: number
): Promise<boolean> {
  const close = ui.get('game-result-close');
  if (!(await close.isVisible())) return false;
  await close.tap({ timeoutMs });
  await close.expect.hidden({ timeoutMs });
  return true;
}

export async function tapSpaceBarControl(
  ui: HarnessActor['ui'],
  handle: string,
  timeoutMs: number
): Promise<void> {
  await dismissGameResult(ui, timeoutMs);
  const control = ui.get(handle);
  try {
    await control.tap({ timeoutMs });
  } catch (error) {
    // A remote final move can put the result over the bar during the tap.
    if (!(await dismissGameResult(ui, timeoutMs))) throw error;
    await control.tap({ timeoutMs });
  }
}
