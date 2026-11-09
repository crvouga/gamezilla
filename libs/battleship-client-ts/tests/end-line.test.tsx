import { afterEach, expect, test } from 'bun:test';
import { BattleshipBoard } from '@libs/battleship-client-ts/battleship-board';
import { statusText } from '@libs/battleship-client-ts/battleship-status';
import {
  encodeBattleshipPosition,
  readBattleshipPosition,
} from '@libs/battleship-shared-ts/battleship-position';
import { resolveBattleshipShot } from '@libs/battleship-shared-ts/battleship-rules';
import type { GameSetups } from '@pkgs/turn-game-shared-ts/game-rules';
import { cleanup } from '@solidjs/testing-library';
import { renderBoard } from './render';

afterEach(cleanup);

const BLUE =
  'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h';
const RED =
  'fleet:carrier@f2h;battleship@f4h;cruiser@f6h;submarine@f8h;destroyer@f10h';
const FLEETS: GameSetups = { white: BLUE, black: RED };
const RED_CELLS = 'f2 g2 h2 i2 j2 f4 g4 h4 i4 f6 g6 h6 f8 g8 h8 f10 g10'.split(
  ' '
);
const RED_MISSES = 'a2 b2 c2 d2 e2 f2 g2 h2 i2 j2 a4 b4 c4 d4 e4 f4'.split(' ');

/** Blue fires at every Red ship cell, Red missing in between: Blue wins. */
function blueWins(): string {
  const actions: string[] = [];
  RED_CELLS.forEach((cell, i) => {
    for (const shot of [cell, RED_MISSES[i]]) {
      if (shot === undefined) continue;
      const action = resolveBattleshipShot(
        encodeBattleshipPosition(actions),
        shot,
        FLEETS
      );
      if (action === null) throw new Error(`Refused ${shot}`);
      actions.push(action);
    }
  });
  return encodeBattleshipPosition(actions);
}

function finished(orientation: 'white' | 'black', setup: string | null) {
  renderBoard(() => (
    <BattleshipBoard
      position={blueWins()}
      orientation={orientation}
      interactive={false}
      sound={false}
      syncKey={0}
      setup={setup}
      hand={null}
      committed={[]}
      commitment={null}
      testId="end"
      onAction={() => undefined}
    />
  ));
  return document.body.textContent ?? '';
}

// regression: battleship-loser-told-as-onlooker — the player whose fleet
// was sunk read "Red fleet destroyed — all five ships sunk." over their own
// fleet, as a watcher would. The game's end is said once, by the frame's
// status line, to each reader; the boards add no line of their own.
test('the end of the game is said to the winner, the loser and a watcher', () => {
  const position = readBattleshipPosition(blueWins());
  if (position === null) throw new Error('Unreadable position');
  expect(statusText(position, 'white')).toContain(
    'You sank the whole fleet. You win.'
  );
  expect(statusText(position, 'black')).toContain(
    'Blue fleet sank your whole fleet.'
  );
  expect(statusText(position, null)).toContain(
    'Blue fleet sank the whole fleet.'
  );
  const loser = finished('black', RED);
  expect(loser).not.toContain('destroyed');
  expect(loser).not.toContain('Red fleet destroyed');
});
