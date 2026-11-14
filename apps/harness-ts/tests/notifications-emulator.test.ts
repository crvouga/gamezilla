import { expect, test } from 'bun:test';
import { openNotificationsEmulator } from '../src/notifications-emulator';

test('the notification screens draw themselves into their element, once it is opened', async () => {
  // Already loaded here, so opening has only promises left to wait for.
  await import('@crvouga/mockingbird-notifications');
  await import('@crvouga/mockingbird-notifications/ui');
  const opened = openNotificationsEmulator(() => []);
  document.body.append(opened.element);
  try {
    // Drawn after it opens: the element is on the page first, and empty.
    expect(opened.element.childElementCount).toBe(0);
    for (
      let turn = 0;
      turn < 1000 && opened.element.childElementCount === 0;
      turn += 1
    )
      await Promise.resolve();
    const text = opened.element.textContent ?? '';
    expect(text).toContain('Notifications');
    expect(text).not.toContain('could not be loaded');
    // The product sends through no messaging vendor yet, and the screens say so.
    expect(text).toContain('No messaging emulators found yet');
  } finally {
    opened.dispose();
    opened.element.remove();
  }
});
