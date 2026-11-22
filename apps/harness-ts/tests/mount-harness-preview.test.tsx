import { expect, test } from 'bun:test';
import { mountHarnessPreview } from '@apps/harness-ts/mount-harness-preview';
import { onCleanup } from 'solid-js';

test('switching to System and back keeps the mounted Instances session', async () => {
  const host = document.createElement('main');
  const before = window.location.href;
  let mounts = 0;
  let disposals = 0;
  document.body.append(host);
  const shell = mountHarnessPreview(host, async () => ({
    HarnessBoot() {
      mounts++;
      onCleanup(() => {
        disposals++;
      });
      return <input aria-label="Instance work" />;
    },
  }));
  try {
    await shell.show('instances');
    const input = host.querySelector('input');
    if (!input) throw new Error('Instances failed to mount');
    input.value = 'unfinished work';
    await shell.show('system');
    expect(shell.active()).toBe('system');
    await shell.show('instances');
    expect(host.querySelector('input')).toBe(input);
    expect(input.value).toBe('unfinished work');
    expect(mounts).toBe(1);
    expect(disposals).toBe(0);
  } finally {
    shell.destroy();
    host.remove();
    window.history.replaceState(null, '', before);
  }
  expect(disposals).toBe(1);
});
