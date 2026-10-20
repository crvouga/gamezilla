import { expect, test } from 'bun:test';
import { judgePuzzleAction } from '@libs/game-puzzle-shared/puzzle-judge';
import { forEveryGame } from '../game-suite';
import { puzzleCase } from './puzzle-room';

forEveryGame(import.meta.path, (game) => {
  const c = puzzleCase(game);
  // regression: puzzle-stored-mate-continues
  test('a rules win ends play even when the matching stored move has another reply', () => {
    expect(c.known.length).toBeGreaterThan(0);
    for (const fixture of c.known) {
      const idx = fixture.record.line.length - 1;
      const action = fixture.record.line[idx]!;
      const position = c.trail(fixture)[idx]!;
      // The plugin's result is the input authority being tested here;
      // the shared rules laws independently hold its known game results.
      const played = c.rules.play(position, action, '', []);
      expect(played).not.toBeNull();
      const wins = played!.winner === fixture.solverSide;
      const continued = [...fixture.record.line, 'unreachable-reply'];
      const judgement = judgePuzzleAction({
        game: c.puzzleGame,
        position,
        line: continued,
        idx,
        solverSide: fixture.solverSide,
        action,
      });
      expect(judgement).toMatchObject({
        kind: 'correct',
        via: wins ? 'win' : 'line',
        ends: wins,
        line: wins ? fixture.record.line : continued,
      });
    }
  });
});
