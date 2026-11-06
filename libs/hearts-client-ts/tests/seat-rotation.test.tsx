import { afterEach, expect, test } from 'bun:test';
import { HeartsBoard } from '@libs/hearts-client-ts/hearts-board';
import { heartsRules } from '@libs/hearts-shared-ts/hearts-rules';
import {
  GAME_SIDES,
  type GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import {
  GameTableSeat,
  GameTableSeats,
} from '@pkgs/ui-root-client-ts/game-table-seat';
import { cleanup } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { byTestId, renderBoard } from './render';

afterEach(cleanup);

// regression: hearts-rotating-seats-nest-identities
test('every rotation keeps each literal player and score in its own seat', () => {
  const names: Record<GameSide, string> = {
    white: 'avery',
    black: 'jordan_plays',
    red: 'morgan',
    blue: 'robin_42',
  };
  const [orientation, setOrientation] = createSignal<GameSide>('white');
  renderBoard(() => (
    <GameTableSeats
      seat={(side) => ({
        name: names[side as GameSide],
        content: <GameTableSeat name={names[side as GameSide]} />,
      })}
    >
      <HeartsBoard
        position={heartsRules.initial()}
        orientation={orientation()}
        interactive
        sound={false}
        syncKey={0}
        setup={null}
        hand="2C3C4C5C6C2H3H4H5H6H7H8H9H"
        commitment={null}
        committed={[]}
        testId="rotation"
        onAction={() => undefined}
      />
    </GameTableSeats>
  ));
  for (const side of [...GAME_SIDES, ...GAME_SIDES].reverse()) {
    setOrientation(side);
    for (const identity of GAME_SIDES) {
      const seat = byTestId(`rotation-seat-${identity}`);
      expect(seat.textContent).toContain(names[identity]);
      expect(
        seat.querySelectorAll('[data-component="GameTableSeat"]')
      ).toHaveLength(1);
      expect(seat.textContent).toContain('13 cards');
      expect(seat.textContent).toContain('Score 0');
      for (const other of Object.values(names).filter(
        (name) => name !== names[identity]
      ))
        expect(seat.textContent).not.toContain(other);
    }
    expect(
      byTestId(`rotation-seat-${side}`).getAttribute('data-position')
    ).toBe('bottom');
  }
});
