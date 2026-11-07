import { afterEach, expect, test } from 'bun:test';
import { boardArgs } from '@libs/game-session-client-ts/game-frame-table.example';
import { PongBoardView } from '@libs/pong-client-ts/pong-board-view';
import { PongJourney } from '@libs/pong-client-ts/pong-journey.example';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent } from '@solidjs/testing-library';

afterEach(cleanup);

test('Pong returns the ball, preserves the court offline, restores input and scores', () => {
  const view = renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width: 390, height: 844 }}>
      <PongJourney>
        {(position, simulation) => (
          <PongBoardView
            {...boardArgs('')}
            position={position()}
            simulation={simulation}
          />
        )}
      </PongJourney>
    </ThemeProvider>
  ));
  const court = view.getByRole('application', { name: 'Pong court' });
  const y = () =>
    Number(
      view.container
        .querySelector('rect[data-side="first"][data-controlled="true"]')
        ?.getAttribute('y')
    );
  const before = y();
  fireEvent.keyDown(court, { key: 'ArrowUp' });
  fireEvent.keyUp(court, { key: 'ArrowUp' });
  expect(y()).toBeLessThan(before);
  expect(view.getByTestId('pong-journey-returns').textContent).toBe(
    '1 returns'
  );
  fireEvent.click(view.getByRole('button', { name: /^Disconnect$/ }));
  const stopped = y();
  fireEvent.keyDown(court, { key: 'ArrowDown' });
  expect(y()).toBe(stopped);
  expect(court.getAttribute('data-interactive')).toBe('false');
  fireEvent.click(view.getByRole('button', { name: 'Restore connection' }));
  fireEvent.keyDown(court, { key: 'ArrowDown' });
  fireEvent.keyUp(court, { key: 'ArrowDown' });
  expect(y()).toBeGreaterThan(stopped);
  fireEvent.click(view.getByRole('button', { name: 'Advance three seconds' }));
  expect(view.getByTestId('pong-journey-points').textContent).toBe('1 points');
  expect(view.getByText('Left 1')).toBeDefined();
});
