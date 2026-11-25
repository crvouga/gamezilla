import { expect, test } from 'bun:test';
import { PreviewShell } from '@apps/harness-ts/mount-harness-preview';
import { render } from '@solidjs/web';
import { createAgent } from '@ui-sdk/solid/agent';
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

test('an agent selects preview surfaces by name, including System, and sees changes made by the switcher', async () => {
  const root = document.createElement('main');
  const before = window.location.href;
  window.history.replaceState(null, '', '?surface=system');
  document.body.append(root);
  const mounted: string[] = [];
  const disposed: string[] = [];
  const apps = ['alice', 'bob'].map((id) => ({
    id,
    label: `Device ${id}`,
    content: () => {
      mounted.push(id);
      onCleanup(() => {
        disposed.push(id);
      });
      return <input aria-label={id} />;
    },
  }));
  const dispose = render(
    () => <PreviewShell apps={apps} initial="alice" />,
    root
  );
  const agent = createAgent();
  const picker = () =>
    agent.snapshot().find((item) => item.label === 'Preview surfaces');
  const select = (name: string) =>
    agent.act({
      steps: [{ ref: 'Preview surfaces', action: 'setValue', args: [name] }],
    });
  try {
    expect(picker()?.['value']).toBe('system');
    expect(picker()?.items).toEqual([
      { value: 'system', label: 'System' },
      { value: 'alice', label: 'Device alice' },
      { value: 'bob', label: 'Device bob' },
    ]);
    expect(mounted).toEqual([]);
    expect((await select('Device bob')).ok).toBe(true);
    const input = root.querySelector<HTMLInputElement>(
      'input[aria-label="bob"]'
    );
    if (!input) throw new Error('Bob did not mount');
    input.value = 'ongoing';
    expect(mounted).toEqual(['bob']);
    expect(new URL(window.location.href).searchParams.get('surface')).toBe(
      'bob'
    );
    expect((await select('System')).ok).toBe(true);
    expect(picker()?.['value']).toBe('system');
    expect(
      root.querySelector('[data-surface="system"]')?.hasAttribute('hidden')
    ).toBe(false);
    expect((await select('unlisted')).ok).toBe(false);
    root
      .querySelector<HTMLButtonElement>('[data-testid="system-switcher-next"]')
      ?.click();
    await Promise.resolve();
    expect(picker()?.['value']).toBe('alice');
    expect((await select('Device bob')).ok).toBe(true);
    expect(root.querySelector('input[aria-label="bob"]')).toBe(input);
    expect(input.value).toBe('ongoing');
  } finally {
    dispose();
    root.remove();
    window.history.replaceState(null, '', before);
  }
  expect(disposed.sort()).toEqual(['alice', 'bob']);
  expect(picker()?.actions ?? []).toEqual([]);
});
