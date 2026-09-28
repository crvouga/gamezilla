/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { SurfaceStackProvider } from '@pkgs/ui';
import {
  type Command,
  CommandPalette,
  CommandPaletteTrigger,
  CommandRegistryProvider,
  RegisterCommand,
  useCommand,
  useCommandPalette,
  useCommandPaletteShortcut,
  useCommandRegistry,
  useRegisterCommands,
} from '@pkgs/ui/components/command-palette';
import {
  isMacPlatform,
  KeyboardShortcutScope,
} from '@pkgs/ui/components/keyboard-shortcuts';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { type Accessor, createSignal, type JSX, Show } from 'solid-js';
import { mustQuery, renderUi } from './support/render';

/** `mod` → Meta on macOS web, Ctrl elsewhere. */
const MOD = isMacPlatform() ? 'Meta' : 'Control';

function Commands(props: {
  commands: Accessor<readonly Command[]>;
}): JSX.Element {
  useRegisterCommands(() => props.commands());
  return null;
}

function Shell(props: {
  commands: readonly Command[];
  enableDefaultShortcuts?: boolean;
  children?: JSX.Element;
}): JSX.Element {
  return (
    <SurfaceStackProvider>
      <CommandRegistryProvider
        enableDefaultShortcuts={props.enableDefaultShortcuts}
      >
        <Commands commands={() => props.commands} />
        <CommandPaletteTrigger />
        <CommandPalette />
        {props.children}
      </CommandRegistryProvider>
    </SurfaceStackProvider>
  );
}

function baseCommands(onRun: (id: string) => void): Command[] {
  return [
    {
      id: 'new-space',
      title: 'New space',
      category: 'Spaces',
      keywords: ['create'],
      run: () => onRun('new-space'),
    },
    {
      id: 'join-space',
      title: 'Join space',
      category: 'Spaces',
      run: () => onRun('join-space'),
    },
    {
      id: 'sign-out',
      title: 'Sign out',
      category: 'Account',
      shortcut: 'mod+shift+q',
      run: () => onRun('sign-out'),
    },
    {
      id: 'disabled',
      title: 'Disabled thing',
      enabled: false,
      run: () => onRun('disabled'),
    },
  ];
}

const openPalette = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Open command palette' }));
};

describe('CommandPalette', () => {
  test('trigger opens the dialog with a focused combobox, listbox and grouped rows', () => {
    renderUi(() => <Shell commands={baseCommands(() => {})} />, {
      width: 1200,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    const trigger = screen.getByRole('button', {
      name: 'Open command palette',
    });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    openPalette();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('dialog', { name: 'Command palette' })
    ).toBeInTheDocument();
    const input = screen.getByRole('combobox');
    expect(input).toHaveFocus();
    const listbox = screen.getByRole('listbox');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(
      ['Disabled thing', 'Sign out⌘⇧Q', 'Join space', 'New space'].map((s) =>
        isMacPlatform() ? s : s.replace('⌘', 'Ctrl')
      )
    );
    expect(screen.getByText('Spaces')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toBeDisabled();
    expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);
  });

  test('typing filters, arrows move the selection, Enter runs and closes, recent bubbles up', async () => {
    const user = userEvent.setup();
    const ran = mock();
    renderUi(() => <Shell commands={baseCommands(ran)} />, { width: 1200 });
    openPalette();
    const input = screen.getByRole('combobox');
    await user.type(input, 'space');
    let options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'New space',
      'Join space',
    ]);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[1]?.id);
    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await user.keyboard('{ArrowUp}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await user.keyboard('{Enter}');
    expect(ran).toHaveBeenCalledWith('join-space');
    await Promise.resolve();
    expect(screen.queryByRole('dialog')).toBeNull();

    // Reopen: the ran command leads a Recent section and the query is reset.
    openPalette();
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Join space');
  });

  test('clicking a row runs it; disabled rows do not run; Escape and scrim close', async () => {
    const user = userEvent.setup();
    const ran = mock();
    renderUi(() => <Shell commands={baseCommands(ran)} />, { width: 1200 });
    openPalette();
    fireEvent.click(screen.getByRole('option', { name: 'Disabled thing' }));
    expect(ran).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('option', { name: 'New space' }));
    expect(ran).toHaveBeenCalledWith('new-space');
    await Promise.resolve();
    expect(screen.queryByRole('dialog')).toBeNull();

    openPalette();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    openPalette();
    fireEvent.click(mustQuery('[data-component="ModalScrim"]'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('no match shows the empty state', async () => {
    const user = userEvent.setup();
    renderUi(() => <Shell commands={baseCommands(() => {})} />, {
      width: 1200,
    });
    openPalette();
    await user.type(screen.getByRole('combobox'), 'zzzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No matching commands')).toBeInTheDocument();
  });

  test('failed command keeps the palette open and shows an inline error; retry clears it', async () => {
    let fail = true;
    const commands: Command[] = [
      {
        id: 'flaky',
        title: 'Flaky',
        run: () => {
          if (fail) throw new Error('boom');
        },
      },
    ];
    renderUi(() => <Shell commands={commands} />, { width: 1200 });
    openPalette();
    fireEvent.click(screen.getByRole('option', { name: 'Flaky' }));
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
    fail = false;
    fireEvent.click(screen.getByRole('option', { name: /Flaky/ }));
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('fuzzy highlights render as inline spans under one line-clamped host', async () => {
    const user = userEvent.setup();
    const commands: Command[] = [
      {
        id: 'light',
        title: 'Use light theme',
        category: 'Appearance',
        run: () => {},
      },
      {
        id: 'system',
        title: 'Use system theme',
        category: 'Appearance',
        run: () => {},
      },
    ];
    renderUi(() => <Shell commands={commands} />, { width: 1200 });
    openPalette();
    await user.type(screen.getByRole('combobox'), 'theme');
    const option = screen.getByRole('option', { name: /Use ligh/ });
    const host = option.querySelector('p.text');
    expect(host).not.toBeNull();
    expect(host?.classList.contains('line-clamp-1')).toBe(true);
    expect(host?.querySelectorAll('p').length).toBe(0);
    const spans = [...(host?.querySelectorAll('span') ?? [])];
    expect(spans.length).toBeGreaterThan(1);
    expect(spans.map((s) => s.textContent).join('')).toBe('Use light theme');
    expect(spans.some((s) => s.classList.contains('textBodyBold'))).toBe(true);
  });
});

describe('shortcuts', () => {
  test('mod+k toggles the palette; command shortcuts run without opening', async () => {
    const user = userEvent.setup();
    const ran = mock();
    renderUi(() => <Shell commands={baseCommands(ran)} />, { width: 1200 });
    await user.keyboard(`{${MOD}>}k{/${MOD}}`);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard(`{${MOD}>}k{/${MOD}}`);
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.keyboard(`{${MOD}>}{Shift>}q{/Shift}{/${MOD}}`);
    expect(ran).toHaveBeenCalledWith('sign-out');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('useCommandPaletteShortcut binds custom keys when defaults are off', async () => {
    const user = userEvent.setup();
    function Custom(): JSX.Element {
      useCommandPaletteShortcut({ keys: ['mod+j'] });
      return null;
    }
    renderUi(
      () => (
        <Shell commands={baseCommands(() => {})} enableDefaultShortcuts={false}>
          <Custom />
        </Shell>
      ),
      { width: 1200 }
    );
    await user.keyboard(`{${MOD}>}k{/${MOD}}`);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.keyboard(`{${MOD}>}j{/${MOD}}`);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('nested KeyboardShortcutScope routes mod+k to the active panel registry', async () => {
    const user = userEvent.setup();
    const [panelActive, setPanelActive] = createSignal(false);
    renderUi(
      () => (
        <KeyboardShortcutScope active={!panelActive()}>
          <SurfaceStackProvider>
            <CommandRegistryProvider>
              <RegisterCommand
                id="harness-theme"
                title="Use dark theme"
                run={() => {}}
              />
              <CommandPalette />
              <KeyboardShortcutScope active={panelActive()}>
                <SurfaceStackProvider>
                  <CommandRegistryProvider>
                    <RegisterCommand
                      id="panel-nav"
                      title="Go to Spaces"
                      run={() => {}}
                    />
                    <CommandPalette />
                  </CommandRegistryProvider>
                </SurfaceStackProvider>
              </KeyboardShortcutScope>
            </CommandRegistryProvider>
          </SurfaceStackProvider>
        </KeyboardShortcutScope>
      ),
      { width: 1200 }
    );

    await user.keyboard(`{${MOD}>}k{/${MOD}}`);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Use dark theme' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Go to Spaces' })).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    setPanelActive(true);
    await user.keyboard(`{${MOD}>}k{/${MOD}}`);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Go to Spaces' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Use dark theme' })).toBeNull();
  });
});

describe('registry hooks', () => {
  test('RegisterCommand / useRegisterCommands register while mounted and react to changes', () => {
    const [extra, setExtra] = createSignal<readonly Command[]>([]);
    const [showDeclarative, setShowDeclarative] = createSignal(true);
    let registry: ReturnType<typeof useCommandRegistry> | undefined;
    function Probe(): JSX.Element {
      registry = useCommandRegistry();
      return null;
    }
    renderUi(() => (
      <SurfaceStackProvider>
        <CommandRegistryProvider enableDefaultShortcuts={false}>
          <Probe />
          <Commands commands={extra} />
          <Show when={showDeclarative()}>
            <RegisterCommand id="decl" title="Declarative" run={() => {}} />
          </Show>
        </CommandRegistryProvider>
      </SurfaceStackProvider>
    ));
    const ids = (): string[] => (registry?.commands() ?? []).map((c) => c.id);
    expect(ids()).toEqual(['decl']);
    setExtra([
      { id: 'a', title: 'A', run: () => {} },
      { id: 'b', title: 'B', run: () => {} },
    ]);
    expect(ids().sort()).toEqual(['a', 'b', 'decl']);
    setExtra([{ id: 'b', title: 'B2', run: () => {} }]);
    expect(ids().sort()).toEqual(['b', 'decl']);
    expect(registry?.store.get('b')?.title).toBe('B2');
    setShowDeclarative(false);
    expect(ids()).toEqual(['b']);
  });

  test('useCommand and useCommandPalette expose reactive handles', async () => {
    const ran = mock();
    let handle: ReturnType<typeof useCommand> | undefined;
    let palette: ReturnType<typeof useCommandPalette> | undefined;
    function Probe(): JSX.Element {
      handle = useCommand('go');
      palette = useCommandPalette();
      return null;
    }
    renderUi(() => (
      <SurfaceStackProvider>
        <CommandRegistryProvider enableDefaultShortcuts={false}>
          <RegisterCommand id="go" title="Go" run={ran} />
          <Probe />
          <CommandPalette />
        </CommandRegistryProvider>
      </SurfaceStackProvider>
    ));
    expect(handle?.exists()).toBe(true);
    expect(handle?.error()).toBeUndefined();
    expect(palette?.isOpen()).toBe(false);
    palette?.open();
    expect(palette?.isOpen()).toBe(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await handle?.run();
    expect(ran).toHaveBeenCalledTimes(1);
    expect(palette?.isOpen()).toBe(false);
    palette?.toggle();
    expect(palette?.isOpen()).toBe(true);
    palette?.close();
    expect(palette?.isOpen()).toBe(false);
  });
});
