import { expect, test } from 'bun:test';
import { MultiplayerSeat } from '@libs/game-matchmaking-client-ts/multiplayer-seat';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { createSignal } from 'solid-js';
import {
  frameFixture,
  MATCH,
  renderMatchFrame,
  VIEWER,
} from './multiplayer-presentation-fixture';

test('matched seats retain wall counts and sunk-ship facts in the displayed position', () => {
  // regression: matched-frame-seat-information-missing
  const [position, setPosition] = createSignal('fixture:live');
  const frame = frameFixture(
    {},
    {
      stat: (fen) => ({
        label: 'Walls',
        value: fen === 'fixture:live' ? '9' : '10',
      }),
      facts: (fen, side, committed) => {
        expect(side).toBe('white');
        expect(committed).toEqual([]);
        return fen === 'fixture:live' ? ['Patrol boat sunk'] : [];
      },
      out: (fen) => fen === 'fixture:live',
    }
  );
  const view = renderMatchFrame(frame, () => (
    <MultiplayerSeat
      game={MATCH}
      position={position()}
      side="white"
      own
      near
      viewer={VIEWER}
    />
  ));
  expect(view.getByText('Walls')).toBeInTheDocument();
  expect(view.getByText('9')).toBeInTheDocument();
  expect(view.getByText('Patrol boat sunk')).toBeInTheDocument();
  expect(view.getByText('Out')).toBeInTheDocument();
  setPosition('fixture:review');
  expect(view.getByText('10')).toBeInTheDocument();
  expect(view.queryByText('Patrol boat sunk')).toBeNull();
  expect(view.queryByText('Out')).toBeNull();
  expect(MATCH.fen).toBe('fixture:live');
});

test('seat statistics follow changing displayed values independently of board orientation', () => {
  assertProperty(
    'matched frame seat statistics',
    fc.property(fc.integer({ min: 0, max: 100 }), (walls) => {
      const frame = frameFixture(
        {},
        {
          stat: (position, side) => ({
            label: `${side} walls`,
            value: position,
          }),
        }
      );
      const [position, setPosition] = createSignal(String(walls));
      const view = renderMatchFrame(frame, () => (
        <MultiplayerSeat
          game={MATCH}
          position={position()}
          side="black"
          own={false}
          near
          viewer={VIEWER}
        />
      ));
      expect(view.getByText('black walls')).toBeInTheDocument();
      expect(view.getByText(String(walls))).toBeInTheDocument();
      setPosition(String(walls + 1));
      expect(view.getByText(String(walls + 1))).toBeInTheDocument();
      view.unmount();
    })
  );
});
