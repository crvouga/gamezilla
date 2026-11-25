import type { Driver, UiWaitOptions } from './driver';

export async function dismissDialogOutcome(
  driver: Driver,
  dialogId: string,
  dismissId: string,
  options?: UiWaitOptions
): Promise<void> {
  const dialog = driver.get(dialogId);
  const dismiss = driver.get(dismissId);
  await dialog.wait('hidden', { ...options, visibleOr: [dismissId] });
  if (await dismiss.isVisible()) {
    try {
      await dismiss.tap(options);
    } catch (error) {
      if (await dialog.isVisible()) throw error;
    }
  }
  await dialog.wait('hidden', options);
}
