import { expect, test } from 'bun:test';
import { ContentAttemptScreenView } from '@libs/game-puzzle-client-ts/content-attempt-screen-view';
import type { ContentAttemptPlace } from '@libs/game-puzzle-client-ts/content-places';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { P } from '@pkgs/ui-root-client-ts/text';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

/** The attempt on its board, with "Progress" opening where it stands. */
function fixture(initial: 'panel' | 'board' | undefined) {
  const [placement, setPlacement] = createSignal(initial);
  const [place, setPlace] = createSignal<ContentAttemptPlace>({
    screen: 'attempt',
  });
  const view = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 768, height: 1024 }}
    >
      <ContentAttemptScreenView
        status="ready"
        place={place()}
        onOpen={setPlace}
        attempt={{
          id: 'attempt',
          sourceId: 'puzzle',
          packRevisionId: null,
          title: 'Puzzle',
          difficulty: 'Easy',
          description: '',
        }}
        playtest={false}
        saving={false}
        changeError={null}
        complete={false}
        rulesChanged={false}
        unopenable={false}
        figures={[
          { key: 'connectedPairs', label: 'Connected pairs', value: '2' },
        ]}
        figuresPlacement={placement()}
        player={
          <P dataSet={{ testid: 'inline-figures' }}>2/5 pairs connected</P>
        }
        onRetryChange={() => undefined}
        onReturnToLibrary={() => undefined}
      />
    </ThemeProvider>
  ));
  return { view, setPlacement };
}

// regression: numberlink-attempt-figures-duplicated
test('a board that presents its figures omits the repeated panel figures', () => {
  const { view } = fixture('board');
  try {
    expect(view.getByTestId('inline-figures').textContent).toBe(
      '2/5 pairs connected'
    );
    expect(view.getByTestId('content-position-save-status').textContent).toBe(
      'Progress saved on this device.'
    );
    // Where the attempt stands does not repeat what the board presents.
    fireEvent.click(view.getByTestId('content-open-progress'));
    expect(view.getByTestId('puzzle-attempt-panel')).toBeDefined();
    expect(view.queryByTestId('puzzle-attempt-figures') === null).toBe(true);
    expect(view.getByTestId('content-position-save-status').textContent).toBe(
      'Progress saved on this device.'
    );
  } finally {
    view.unmount();
  }
});

test('other puzzle consumers retain panel figures by default and explicit choice', () => {
  const { view, setPlacement } = fixture(undefined);
  try {
    // The panel is where the attempt stands: its progress screen.
    expect(view.queryByTestId('puzzle-attempt-figures') === null).toBe(true);
    fireEvent.click(view.getByTestId('content-open-progress'));
    expect(view.getByTestId('puzzle-attempt-figures').textContent).toContain(
      'Connected pairs'
    );
    setPlacement('board');
    expect(view.queryByTestId('puzzle-attempt-figures') === null).toBe(true);
    setPlacement('panel');
    expect(view.getByTestId('puzzle-attempt-figures').textContent).toContain(
      '2'
    );
  } finally {
    view.unmount();
  }
});
