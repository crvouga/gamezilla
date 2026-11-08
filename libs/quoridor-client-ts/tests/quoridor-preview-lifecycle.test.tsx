import { expect, test } from 'bun:test';
import { createQuoridorBoard } from '@libs/quoridor-client-ts/quoridor-board';
import {
  encodeQuoridor,
  newQuoridor,
  playQuoridor,
} from '@libs/quoridor-shared-ts/quoridor';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

function mountBoard(mode: 'classic' | 'hill') {
  const { clock, timers } = createHarnessClock();
  const [game, setGame] = createSignal(newQuoridor(mode));
  const [syncKey, setSyncKey] = createSignal(0);
  const actions: string[] = [];
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        {createQuoridorBoard({
          get position() {
            return encodeQuoridor(game());
          },
          get syncKey() {
            return syncKey();
          },
          orientation: 'white',
          interactive: true,
          sound: false,
          setup: null,
          hand: null,
          committed: [],
          commitment: null,
          testId: 'lifecycle',
          onAction: (action) => actions.push(action),
        }).Board()}
      </ThemeProvider>
    </ClockProvider>
  ));
  const anchor = () => view.getByTestId('lifecycle-action-d4h');
  fireEvent.click(view.getByTestId('lifecycle-mode-h'));
  fireEvent.focus(anchor());
  fireEvent.click(anchor());
  return {
    view,
    anchor,
    actions,
    setSyncKey,
    advance: () => setGame(playQuoridor(game(), 'e2')!),
  };
}

// regression: quoridor-escape-preview-cancel
test('Escape on a selected wall anchor cancels without spending a wall in both variants', () => {
  for (const mode of ['classic', 'hill'] as const) {
    const { view, anchor, actions } = mountBoard(mode);
    fireEvent.keyDown(anchor(), { key: 'Escape' });
    expect(view.queryByTestId('lifecycle-wall-commit')).toBeNull();
    expect(anchor().getAttribute('data-preview-edge-top')).toBe('false');
    expect(actions).toEqual([]);
    view.unmount();
  }
});

// regression: quoridor-stale-preview-on-position-change
test('an incoming move clears both the selected and focused wall preview', () => {
  for (const mode of ['classic', 'hill'] as const) {
    const { view, anchor, advance } = mountBoard(mode);
    advance();
    expect(view.queryByTestId('lifecycle-wall-commit')).toBeNull();
    expect(anchor().getAttribute('data-preview-edge-top')).toBe('false');
    expect(view.getByTestId('lifecycle-wall-status').textContent).not.toContain(
      'Preview only'
    );
    view.unmount();
  }
});

// regression: quoridor-stale-preview-on-reset
test('a host reset clears the proposed wall even when the position is unchanged', () => {
  for (const mode of ['classic', 'hill'] as const) {
    const { view, anchor, setSyncKey } = mountBoard(mode);
    setSyncKey(1);
    expect(view.queryByTestId('lifecycle-wall-commit')).toBeNull();
    expect(anchor().getAttribute('data-preview-edge-top')).toBe('false');
    view.unmount();
  }
});
