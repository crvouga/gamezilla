import { afterEach, expect, test } from 'bun:test';
import { LightCyclesBoard } from '@libs/light-cycles-client-ts/light-cycles-board';
import { lightCyclesConfig } from '@libs/light-cycles-shared-ts/light-cycles-config';
import {
  lightCyclesPositionCodec,
  lightCyclesStart,
} from '@libs/light-cycles-shared-ts/light-cycles-position';
import type { LightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import { createLightCyclesStep } from '@libs/light-cycles-shared-ts/light-cycles-step';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

afterEach(cleanup);

const trio = lightCyclesPositionCodec(3);
const step = createLightCyclesStep(lightCyclesConfig());

function running(state: LightCyclesState): LightCyclesState {
  return { ...state, phase: 'running', phaseTick: 1 };
}

function board(sides: readonly GameSide[], initial: LightCyclesState) {
  const [position, setPosition] = createSignal(trio.encode(initial));
  const [stale, setStale] = createSignal(false);
  const inputs: unknown[] = [];
  const view = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <LightCyclesBoard
        position={position()}
        orientation="white"
        interactive={true}
        sound={false}
        syncKey={0}
        testId="arena"
        setup={null}
        onAction={() => {
          throw new Error('Light Cycles has no discrete moves');
        }}
        simulation={{
          paused: false,
          stale: stale(),
          sides,
          onInput: (side, input) => inputs.push([side, input]),
          onRelease: () => {},
        }}
      />
    </ThemeProvider>
  ));
  const set = (state: LightCyclesState) => setPosition(trio.encode(state));
  return { ...view, inputs, set, setStale };
}

test('a rider steers only its own seat, with its round, from the pad and the keyboard', () => {
  const view = board(['black'], running(lightCyclesStart(3, 3)));
  expect(view.queryByTestId('arena-white-pad-up')).toBeNull();
  fireEvent.pointerDown(view.getByTestId('arena-black-pad-up'));
  const arena = view.getByRole('application', { name: 'Light Cycles arena' });
  fireEvent.keyDown(arena, { key: 'ArrowLeft' });
  expect(view.inputs).toEqual([
    ['black', { round: 1, heading: 'up' }],
    ['black', { round: 1, heading: 'left' }],
  ]);
  expect(view.getByTestId('arena-status').dataset['steering']).toBe('riding');
  expect(view.getByTestId('arena-arena-rider-1').dataset['x']).toBe('30');
});

function until(
  state: LightCyclesState,
  done: (state: LightCyclesState) => boolean
): LightCyclesState {
  let current = state;
  for (let tick = 1; !done(current); tick++) {
    if (tick > 2000) throw new Error('the scripted round never got there');
    current = step(current, [], {
      tick,
      deltaMs: 1000 / 30,
      elapsedMs: (tick * 1000) / 30,
      random: () => 0,
    });
  }
  return current;
}

test('a crashed rider, a round result and a lost connection each refuse steering with a reason', () => {
  const start = lightCyclesStart(3, 3);
  const crashed = until(start, (state) => state.crashes.length > 0);
  const seat = crashed.crashes[0]!.seat;
  const view = board([seat], crashed);
  expect(view.getByTestId('arena-status').dataset['steering']).toBe('crashed');
  fireEvent.pointerDown(view.getByTestId(`arena-${seat}-pad-up`));
  expect(view.inputs).toEqual([]);
  const over = until(crashed, (state) => state.phase === 'round-over');
  view.set(over);
  expect(view.getByTestId('arena-status').dataset['steering']).toBe(
    'round-over'
  );
  const winner = over.roundWinner;
  if (winner !== null && winner !== 'draw')
    expect(view.getByTestId(`arena-score-${winner}`).dataset['score']).toBe(
      '1'
    );
  view.set(running(start));
  view.setStale(true);
  expect(view.getByTestId('arena-status').dataset['steering']).toBe('away');
});

test('a watcher sees every rider and no steering control', () => {
  const view = board([], running(lightCyclesStart(3, 3)));
  expect(view.getByTestId('arena-status').dataset['steering']).toBe('watching');
  for (const index of [0, 1, 2])
    expect(view.getByTestId(`arena-arena-rider-${index}`)).toBeDefined();
  expect(view.queryByRole('button', { name: /Steer/ })).toBeNull();
});

test('a finished game tells its riders it is finished, not that they watch', () => {
  // regression: light-cycles-finished-game-says-watching
  // A finished custom game hands its board no steering controls at all, so
  // the reason must come from the game itself.
  const start = lightCyclesStart(3, 1);
  const finished = until(
    running(start),
    (state) => state.phase === 'completed'
  );
  const view = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <LightCyclesBoard
        position={trio.encode(finished)}
        orientation="white"
        interactive={false}
        sound={false}
        syncKey={0}
        testId="arena"
        setup={null}
        onAction={() => {}}
      />
    </ThemeProvider>
  ));
  expect(view.getByTestId('arena-status').dataset['steering']).toBe('finished');
});

test("a person's other device says it does not steer their rider and offers to ride from it", () => {
  let claims = 0;
  const view = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <LightCyclesBoard
        position={trio.encode(running(lightCyclesStart(3, 3)))}
        orientation="white"
        interactive={true}
        sound={false}
        syncKey={0}
        testId="arena"
        setup={null}
        onAction={() => {}}
        simulation={{
          paused: false,
          stale: false,
          sides: [],
          elsewhere: ['white'],
          claim: () => {
            claims += 1;
          },
          onInput: () => {
            throw new Error('a device that does not steer sends no turn');
          },
          onRelease: () => {},
        }}
      />
    </ThemeProvider>
  ));
  expect(view.getByTestId('arena-status').dataset['steering']).toBe(
    'elsewhere'
  );
  expect(view.queryByTestId('arena-white-pad-up')).toBeNull();
  fireEvent.click(view.getByTestId('arena-ride-here'));
  expect(claims).toBe(1);
});
