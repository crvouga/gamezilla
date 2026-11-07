import { afterEach, expect, test } from 'bun:test';
import { HeartsBoard } from '@libs/hearts-client-ts/hearts-board';
import { heartsFrame } from '@libs/hearts-client-ts/hearts-frame';
import type { Card } from '@libs/hearts-shared-ts/hearts-cards';
import { encodeHearts } from '@libs/hearts-shared-ts/hearts-position';
import type { GamePlayerName } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { GameTableSeats } from '@pkgs/ui-root-client-ts/game-table-seat';
import { cleanup } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { byTestId, renderBoard } from './render';

afterEach(cleanup);

const NAMES: Record<GameSide, string> = {
  white: 'Anika Rao',
  black: 'Luis Ortega',
  red: 'Mei Chen',
  blue: 'Zoë Martin',
};
const nameOf: GamePlayerName = (side) => NAMES[side];
const position = (plays: readonly Card[]) =>
  encodeHearts({
    deal: 4,
    phase: 'play',
    scores: [12, 30, 8, 28],
    lead: 0,
    plays: [...plays],
    last: null,
  });
const NORTH_TURN = position(['2C', '3C']);
const EAST_TRICK = position(['2C', '3C', '4C', '5C']);

// regression: hearts-named-opponent-watcher-guidance
test('opponent and watcher hear the resolved North player, while North hears Your turn', () => {
  for (const viewer of ['white', null] as const) {
    expect(heartsFrame.turnStatus(NORTH_TURN, viewer, [], nameOf)).toBe(
      'Mei Chen to play.'
    );
  }
  expect(heartsFrame.turnStatus(NORTH_TURN, 'red', [], nameOf)).toBe(
    'Your turn.'
  );
});

// regression: hearts-named-opponent-watcher-guidance
test('the completed trick names its actual taker for opponents and watchers', () => {
  for (const viewer of ['white', null] as const) {
    expect(heartsFrame.turnStatus(EAST_TRICK, viewer, [], nameOf)).toBe(
      'Zoë Martin took the trick with the five of clubs and leads.'
    );
  }
  expect(heartsFrame.turnStatus(EAST_TRICK, 'blue', [], nameOf)).toBe(
    'You took the trick with the five of clubs and lead.'
  );
});

// regression: hearts-named-opponent-watcher-guidance
test('unknown and whitespace identities retain a meaningful compass fallback', () => {
  for (const unknown of [null, '', '  ']) {
    expect(heartsFrame.turnStatus(NORTH_TURN, null, [], () => unknown)).toBe(
      'North to play.'
    );
    expect(heartsFrame.turnStatus(EAST_TRICK, null, [], () => unknown)).toBe(
      'East took the trick with the five of clubs and leads.'
    );
  }
});

// regression: hearts-named-opponent-watcher-guidance
test('the board reads reactive semantic identity rather than the lent JSX', () => {
  const [name, setName] = createSignal<string | null>('Mei Chen');
  renderBoard(() => (
    <GameTableSeats
      seat={(side) => ({
        get name() {
          return side === 'red' ? name() : NAMES[side as GameSide];
        },
        content: <>Opaque player content</>,
      })}
    >
      <HeartsBoard
        position={NORTH_TURN}
        orientation="white"
        interactive={false}
        sound={false}
        syncKey={0}
        setup={null}
        hand={null}
        commitment={null}
        committed={[]}
        testId="named-hearts"
        onAction={() => undefined}
      />
    </GameTableSeats>
  ));
  expect(byTestId('named-hearts-center').textContent).toBe('Mei Chen to play.');
  setName('Mei Chen updated');
  expect(byTestId('named-hearts-center').textContent).toBe(
    'Mei Chen updated to play.'
  );
  setName(null);
  expect(byTestId('named-hearts-center').textContent).toBe('North to play.');
});
