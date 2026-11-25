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
  if (await dismiss.isVisible()) await dismiss.tap(options);
  await dialog.wait('hidden', options);
}
