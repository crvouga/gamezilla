import { expect, test } from 'bun:test';
import { QuoridorBoard } from '@libs/quoridor-client-ts/quoridor-board';
import {
  encodeQuoridor,
  replayQuoridor,
} from '@libs/quoridor-shared-ts/quoridor';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';

const BLOCKED_HILL = [
  'e2',
  'a4',
  'e8',
  'i6',
  'e1',
  'b4',
  'e7',
  'i5',
  'e2',
  'c4',
  'f7',
  'i6',
  'a1h',
  'd4',
  'f6',
  'i5',
  'c7h',
  'd3',
  'f5',
  'a3h',
  'f7h',
  'e3',
  'f4',
  'c5h',
  'a7v',
  'd2v',
  'e4',
  'g3h',
  'g1h',
  'e2v',
  'd1h',
  'a5v',
];

test('an exhausted blocked player can follow the wall refusal to the pass action', () => {
  // regression: quoridor-exhausted-wall-pass-recovery
  const game = replayQuoridor('hill', BLOCKED_HILL);
  const { clock, timers } = createHarnessClock();
  const actions: string[] = [];
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        <QuoridorBoard
          position={encodeQuoridor(game)}
          interactive={true}
          testId="blocked-hill"
          onAction={(action) => actions.push(action)}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  fireEvent.click(view.getByRole('button', { name: 'Horizontal wall' }));
  fireEvent.focus(view.getByTestId('blocked-hill-action-a1h'));
  expect(view.getByTestId('blocked-hill-wall-status').textContent).toMatch(
    /pass turn/i
  );
  const pass = view.getByTestId('blocked-hill-action-pass');
  expect(pass).not.toBeDisabled();
  fireEvent.click(pass);
  expect(actions).toEqual(['pass']);
  view.unmount();
});
