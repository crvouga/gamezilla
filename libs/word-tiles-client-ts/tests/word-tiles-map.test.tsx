import { expect, test } from 'bun:test';
import { WordTilesBoardView } from '@libs/word-tiles-client-ts/word-tiles-board-view';
import {
  CAT_AND_TOE,
  STORY_LEXICON,
  STORY_LEXICON_KEY,
} from '@libs/word-tiles-client-ts/word-tiles-board-view.example';
import {
  encodePosition,
  newPosition,
} from '@libs/word-tiles-shared-ts/word-tiles-position';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';

// regression: word-tiles-overview-unreadable-context
test('fifteen-column CAT/TOE board map locates a remote intersection without consuming a selected tile', () => {
  const { clock, timers } = createHarnessClock();
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <SurfaceStackProvider>
          <WordTilesBoardView
            position={encodePosition({
              ...newPosition(2, STORY_LEXICON_KEY),
              board: CAT_AND_TOE,
            })}
            orientation="white"
            interactive
            sound={false}
            syncKey={0}
            testId="map-fixture"
            setup={null}
            hand="11,0,82,98,25,77,69"
            committed={[]}
            commitment={null}
            onAction={() => {
              throw new Error('Locating must not submit a turn');
            }}
            lexicon={STORY_LEXICON}
            onRetryLexicon={() => undefined}
            random={() => 0.5}
          />
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  const rack = view.getByTestId('map-fixture-rack-11');
  fireEvent.click(rack);
  expect(
    view.getByTestId('map-fixture-rack-11').getAttribute('aria-pressed')
  ).toBe('true');
  fireEvent.click(view.getByRole('button', { name: 'Enlarge board' }));
  // regression: word-tiles-map-fine-target-detour
  fireEvent.click(view.getByRole('button', { name: 'View a1 to e5' }));
  expect(document.activeElement).toBe(view.getByTestId('map-fixture-cell-c3'));
  expect(
    view.getByTestId('map-fixture-rack-11').getAttribute('aria-pressed')
  ).toBe('true');
  expect(
    view.getByTestId('map-fixture-cell-c3').getAttribute('data-state')
  ).toBe('empty');
  expect(view.queryByRole('dialog')).toBeNull();
  const trigger = view.getByRole('button', {
    name: 'Board map: locate a square',
  });
  trigger.focus();
  fireEvent.click(trigger);
  const map = view.getByTestId('map-fixture-map');
  expect(map.querySelectorAll('[data-cell]')).toHaveLength(225);
  expect(view.getByTestId('map-fixture-map-cell-i8').textContent).toContain(
    'T'
  );
  fireEvent.click(view.getByTestId('map-fixture-map-cell-o15'));
  expect(document.activeElement).toBe(view.getByTestId('map-fixture-cell-o15'));
  expect(
    view.getByTestId('map-fixture-rack-11').getAttribute('aria-pressed')
  ).toBe('true');
  expect(
    view.getByTestId('map-fixture-cell-o15').getAttribute('data-state')
  ).toBe('empty');
  expect(view.queryByRole('dialog')).toBeNull();
  trigger.focus();
  fireEvent.click(trigger);
  fireEvent.keyDown(view.getByTestId('map-fixture-map-cell-h8'), {
    key: 'Escape',
  });
  expect(document.activeElement).toBe(trigger);
  expect(view.queryByRole('dialog')).toBeNull();
});
