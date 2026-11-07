import { expect, test } from 'bun:test';
import { createQuoridorBoard } from '@libs/quoridor-client-ts/quoridor-board';
import {
  encodeQuoridor,
  replayQuoridor,
} from '@libs/quoridor-shared-ts/quoridor';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { GameFrameBoardSession } from '@pkgs/turn-game-shared-ts/game-frame';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

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

test('a forced Hill pass has one action and no contradictory move guidance', () => {
  // regression: quoridor-hill-contradictory-pass-guidance
  const game = replayQuoridor('hill', BLOCKED_HILL);
  const { clock, timers } = createHarnessClock();
  const actions: string[] = [];
  let session: GameFrameBoardSession<JSX.Element> | undefined;
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        {(() => {
          session = createQuoridorBoard({
            position: encodeQuoridor(game),
            orientation: 'white',
            interactive: true,
            sound: false,
            syncKey: 0,
            setup: null,
            hand: null,
            committed: [],
            commitment: null,
            testId: 'blocked-hill',
            onAction: (action) => actions.push(action),
          });
          return session.Board();
        })()}
      </ThemeProvider>
    </ClockProvider>
  ));
  expect(session!.actions()).toEqual([]);
  for (const mode of ['move', 'h', 'v'])
    expect(view.queryByTestId(`blocked-hill-mode-${mode}`)).toBeNull();
  expect(view.queryByTestId('blocked-hill-precise-target')).toBeNull();
  const guidance = view.getByTestId('blocked-hill-wall-status').textContent;
  expect(guidance).toMatch(/pass/i);
  expect(guidance).not.toMatch(/choose a marked square|tap a square/i);
  const pass = view.getByTestId('blocked-hill-action-pass');
  expect(pass.hasAttribute('disabled')).toBe(false);
  fireEvent.click(pass);
  expect(actions).toEqual(['pass']);
  view.unmount();
});
