import { afterEach, expect, test } from 'bun:test';
import { PongBoard } from '@libs/pong-client-ts/pong-board';
import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import { initialPongState } from '@libs/pong-shared-ts/pong-state';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

afterEach(cleanup);

function board(sides: readonly GameSide[]) {
  const [paused, setPaused] = createSignal(false);
  const [position, setPosition] = createSignal(
    pongPositionCodec.encode(initialPongState(pongConfig(), () => 0))
  );
  const inputs: unknown[] = [];
  const view = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <PongBoard
        position={position()}
        orientation="white"
        interactive={true}
        sound={false}
        syncKey={0}
        testId="pong"
        setup={null}
        hand={null}
        committed={[]}
        commitment={null}
        onAction={() => {
          throw new Error('Pong cannot emit a discrete move');
        }}
        simulation={{
          paused: paused(),
          stale: false,
          sides,
          onInput: (side, input) => inputs.push([side, input]),
          onRelease: () => {},
        }}
      />
    </ThemeProvider>
  ));
  return { ...view, inputs, setPaused, setPosition };
}

test('Pong exposes a labelled court and only the player’s normalized paddle controls', () => {
  const view = board(['black']);
  expect(view.getByRole('application', { name: 'Pong court' })).toBeDefined();
  expect(view.queryByRole('slider', { name: 'Left paddle' })).toBeNull();
  const slider = view.getByRole('slider', {
    name: 'Right paddle',
  }) as HTMLInputElement;
  fireEvent.input(slider, { target: { value: '750' } });
  expect(view.inputs).toEqual([['black', { kind: 'target', target: 0.75 }]]);
  view.setPaused(true);
  expect(slider.disabled).toBe(true);
  expect(view.getByRole('status').textContent).toBe(
    'Paused while a player returns.'
  );
});

test('a spectator sees the score without either input control and a malformed position offers a way out', () => {
  // regression: pong-spectator-control-guidance
  const view = board([]);
  expect(view.getByText(/Watching the rally/)).toBeDefined();
  expect(view.queryByText(/Drag up and down/)).toBeNull();
  expect(view.queryAllByRole('slider')).toHaveLength(0);
  expect(view.getByText('Left 0')).toBeDefined();
  expect(view.getByText('Right 0')).toBeDefined();
  view.setPosition('pong:broken');
  expect(view.getByRole('alert').textContent).toContain(
    'Return to your spaces'
  );
});

test('leaving the board releases held normalized paddle input', () => {
  // regression: pong-history-navigation
  const view = board(['white']);
  fireEvent.keyDown(view.getByRole('application'), { key: 'w' });
  view.unmount();
  expect(view.inputs).toEqual([
    ['white', { kind: 'direction', direction: -1 }],
    ['white', { kind: 'direction', direction: 0 }],
  ]);
});

// regression: pong-court-state-and-touch-cues
// Literal round-4 shared phone state: first serve, both paddles controlled.
test('serve and pause remain on court with explicit cues for both touch edges', () => {
  const view = board(['white', 'black']);
  const court = view.getByRole('application');
  expect(court.contains(view.getByRole('status'))).toBe(true);
  expect(view.getByRole('status').textContent).toBe('Serve in 3.');
  for (const side of ['first', 'second'])
    expect(view.getByTestId(`pong-${side}-gesture`).textContent).toContain(
      'Drag'
    );
  view.setPaused(true);
  expect(court.contains(view.getByRole('status'))).toBe(true);
  expect(view.queryByTestId('pong-first-gesture')).toBeNull();
  view.setPaused(false);
  expect(view.getByTestId('pong-first-gesture')).toBeDefined();
  const state = initialPongState(pongConfig(), () => 0);
  view.setPosition(
    pongPositionCodec.encode({
      ...state,
      phase: 'playing',
      countdown: 0,
      ball: { ...state.ball, vx: pongConfig().ballSpeed },
    })
  );
  expect(view.queryByRole('status')).toBeNull();
});

// regression: pong-unreadable-recovery-destination
test('literal unreadable story offers the existing Spaces destination', () => {
  const view = board([]);
  view.setPosition('pong:not-a-position');
  const recovery = view.getByRole('link', { name: 'Back to spaces' });
  expect(recovery.getAttribute('href')).toBe('/');
  expect(view.getByRole('alert').contains(recovery)).toBe(true);
  expect(view.queryByRole('application')).toBeNull();
});
