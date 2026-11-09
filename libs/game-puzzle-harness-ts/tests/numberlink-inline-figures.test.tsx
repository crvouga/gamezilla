import { expect, test } from 'bun:test';
import { ContentAttemptScreenView } from '@libs/game-puzzle-client-ts/content-attempt-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { P } from '@pkgs/ui-root-client-ts/text';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { createSignal } from 'solid-js';

function fixture(initial: 'panel' | 'board' | undefined) {
  const [placement, setPlacement] = createSignal(initial);
  const view = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 768, height: 1024 }}
    >
      <ContentAttemptScreenView
        status="ready"
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
    expect(view.queryByTestId('puzzle-attempt-figures') === null).toBe(true);
    expect(view.getByTestId('inline-figures').textContent).toBe(
      '2/5 pairs connected'
    );
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
