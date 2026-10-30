import { describe, expect, test } from 'bun:test';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal, type JSX } from 'solid-js';
import Example10 from '../../ui-root-client-ts/src/collection-screen/collection-screen.example';
import Example11 from '../../ui-root-client-ts/src/content-screen/content-screen.example';
import Example12 from '../../ui-root-client-ts/src/embedded-screen/embedded-screen.example';
import Example7 from '../../ui-root-client-ts/src/form-screen/form-screen.example';
import Example5 from '../../ui-root-client-ts/src/game-history-screen/game-history-screen.example';
import Example6 from '../../ui-root-client-ts/src/game-review-screen/game-review-screen.example';
import Example1 from '../../ui-root-client-ts/src/game-screen/game-screen.example';
import Example2 from '../../ui-root-client-ts/src/game-session-layout/game-session-layout.example';
import Example3 from '../../ui-root-client-ts/src/game-setup-panel/game-setup-panel.example';
import Example0 from '../../ui-root-client-ts/src/main-menu-screen/main-menu-screen.example';
import Example8 from '../../ui-root-client-ts/src/menu-screen/menu-screen.example';
import Example9 from '../../ui-root-client-ts/src/profile-screen-layout/profile-screen-layout.example';
import Example4 from '../../ui-root-client-ts/src/puzzle-screen/puzzle-screen.example';

const SCREEN_ENTRIES = [
  { id: 'main-menu-screen', Example: Example0 },
  { id: 'game-screen', Example: Example1 },
  { id: 'game-session-layout', Example: Example2 },
  { id: 'game-setup-panel', Example: Example3 },
  { id: 'puzzle-screen', Example: Example4 },
  { id: 'game-history-screen', Example: Example5 },
  { id: 'game-review-screen', Example: Example6 },
  { id: 'form-screen', Example: Example7 },
  { id: 'menu-screen', Example: Example8 },
  { id: 'profile-screen-layout', Example: Example9 },
  { id: 'collection-screen', Example: Example10 },
  { id: 'content-screen', Example: Example11 },
  { id: 'embedded-screen', Example: Example12 },
];

function mountExample(
  id: string,
  width = 390,
  colorScheme: 'light' | 'dark' = 'light'
) {
  const entry = SCREEN_ENTRIES.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Missing screen example: ${id}`);
  const Example = entry.Example;
  const { clock, timers } = createHarnessClock({ startMs: 0 });
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider
        colorScheme={colorScheme}
        fixedLayout={{ width, height: 844 }}
      >
        <Example />
      </ThemeProvider>
    </ClockProvider>
  ));
  return { ...view, clock };
}

describe('screen layout composition contracts', () => {
  test('every screen example renders in compact and wide themes with one screen identity', () => {
    for (const entry of SCREEN_ENTRIES) {
      for (const colorScheme of ['light', 'dark'] as const) {
        for (const width of [390, 1280]) {
          const view = mountExample(entry.id, width, colorScheme);
          const count = entry.id === 'game-setup-panel' ? 0 : 1;
          expect(view.container.querySelectorAll('[data-screen]').length).toBe(
            count
          );
          expect(
            view.queryAllByRole('heading', { level: 1 }).length
          ).toBeLessThanOrEqual(1);
          expect(view.queryByRole('dialog')).toBeNull();
          view.unmount();
        }
      }
    }
  });

  test('custom and matched game examples expose setup, play and result compositions', () => {
    const custom = mountExample('game-screen');
    fireEvent.click(custom.getByRole('button', { name: 'Start round' }));
    expect(custom.getByRole('group', { name: 'Example board' })).toBeDefined();
    fireEvent.click(custom.getByRole('button', { name: 'Finish round' }));
    expect(custom.getByRole('status').textContent).toBe('Round complete');
    fireEvent.click(custom.getByRole('button', { name: 'New round' }));
    expect(custom.getByRole('button', { name: 'Start round' })).toBeDefined();
    custom.unmount();
    const matched = mountExample('game-session-layout');
    fireEvent.click(matched.getByRole('button', { name: 'Find an opponent' }));
    expect(
      matched.getByRole('button', { name: 'Stop searching' })
    ).toBeDefined();
    fireEvent.click(matched.getByRole('button', { name: 'Preview a match' }));
    expect(matched.getByRole('group', { name: 'Example board' })).toBeDefined();
    fireEvent.click(matched.getByRole('button', { name: 'Finish match' }));
    expect(matched.getByRole('status').textContent).toBe('Round complete');
    matched.unmount();
  });

  test('form example keeps feedback in the footer and retains the editor after saving', async () => {
    const view = mountExample('form-screen');
    const input = view.getByRole('textbox');
    fireEvent.input(input, { target: { value: 'Robin' } });
    fireEvent.click(view.getByRole('button', { name: 'Save' }));
    await Promise.resolve();
    await Promise.resolve();
    expect(view.getByRole('textbox')).toBe(input);
    expect(view.getByRole('button', { name: 'Saved' })).toBeDefined();
    expect(
      view.container
        .querySelector('[data-component="ScreenFooter"]')
        ?.contains(view.getByRole('button', { name: 'Saved' }))
    ).toBe(true);
    view.unmount();
  });

  test('a supporting rail can appear without remounting the play surface', () => {
    const [aside, setAside] = createSignal<JSX.Element>(undefined);
    const view = render(() => (
      <GameSessionLayout aside={aside()}>
        <input aria-label="Play surface" />
      </GameSessionLayout>
    ));
    const input = view.getByRole('textbox');
    setAside(<p>Round record</p>);
    expect(view.getByRole('textbox')).toBe(input);
    setAside(undefined);
    expect(view.getByRole('textbox')).toBe(input);
    view.unmount();
  });
});
