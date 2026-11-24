import { expect, test } from 'bun:test';
import { PreviewShell } from '@apps/harness-ts/mount-harness-preview';
import { render } from '@solidjs/web';
import { onCleanup } from 'solid-js';

test('Mockingbird switches directly between clients and retains their mounted state', async () => {
  const root = document.createElement('main');
  const before = window.location.href;
  window.history.replaceState(null, '', '?surface=alice');
  document.body.append(root);
  const disposed: string[] = [];
  const closed = Promise.withResolvers<void>();
  const apps = ['alice', 'bob'].map((id) => ({
    id,
    label: id,
    content: () => {
      onCleanup(() => {
        disposed.push(id);
        if (disposed.length === 2) closed.resolve();
      });
      return <input aria-label={id} />;
    },
  }));
  const dispose = render(
    () => <PreviewShell apps={apps} initial="alice" />,
    root
  );
  try {
    await Promise.resolve();
    const input = root.querySelector<HTMLInputElement>(
      '[aria-label="alice"] input'
    );
    if (!input) throw new Error('Alice did not mount');
    input.value = 'unfinished work';
    const next = root.querySelector<HTMLButtonElement>(
      '[data-testid="system-switcher-next"]'
    );
    if (!next) throw new Error('Missing Mockingbird switcher');
    next.click();
    await Promise.resolve();
    expect(new URL(window.location.href).searchParams.get('surface')).toBe(
      'bob'
    );
    expect(root.querySelector('[aria-label="bob"] input')).toBeTruthy();
    root
      .querySelector<HTMLButtonElement>(
        '[data-testid="system-switcher-previous"]'
      )
      ?.click();
    expect(new URL(window.location.href).searchParams.get('surface')).toBe(
      'alice'
    );
    expect(root.querySelector('[aria-label="alice"] input')).toBe(input);
    expect(input.value).toBe('unfinished work');
    expect(disposed).toEqual([]);
  } finally {
    dispose();
    root.remove();
    window.history.replaceState(null, '', before);
  }
  await closed.promise;
  expect(disposed.sort()).toEqual(['alice', 'bob']);
});
