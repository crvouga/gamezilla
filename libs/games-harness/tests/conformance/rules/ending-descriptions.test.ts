/**
 * Every game keeps its own ending descriptions through the shared
 * presentation contract: the result screens and notices show what the
 * game's presentation says about how the game ended, so each ending its
 * rules reach — its known victory and, for a game its rules can draw, that
 * draw — has a description of its own, distinct endings are never collapsed
 * into one, a reason the game never gives has none, and a game that can be
 * drawn on time names the side that ran out. The endings come from the
 * game's fixtures, played through its rules.
 */

import { expect, test } from 'bun:test';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { forEveryGame } from '../game-suite';

/** The reason the game's rules give for the ending `line` reaches. */
function endingReason(game: HarnessGame, line: readonly string[]): string {
  const rules = game.shared.turnGame.rules;
  let position = rules.initial();
  let history = '';
  const actions: string[] = [];
  for (const action of line) {
    const played = rules.play(position, action, history, actions);
    if (played === null)
      throw new Error(`${game.label}: the fixture's ${action} was refused`);
    actions.push(action);
    position = played.position;
    history = played.history;
    if (played.winner !== null) {
      if (played.reason === null || played.reason === '')
        throw new Error(`${game.label}: the game ended without a reason`);
      return played.reason;
    }
  }
  throw new Error(`${game.label}: the fixture's line never ends the game`);
}

forEveryGame(import.meta.path, (game) => {
  const presentation = game.client.presentation;
  // A turn game's shared screens show its endings only through its
  // presentation; a game must supply one to be shown at all.
  test('the game supplies the presentation its endings are shown through', () => {
    expect(presentation).toBeDefined();
  });
  if (presentation === undefined) return;

  // regression: game-session-ending-descriptions-lost
  test("each ending the game's rules reach keeps a description of its own", () => {
    const endings = [
      endingReason(game, game.fixtures.firstSideVictory),
      ...(game.fixtures.drawByRules === undefined
        ? []
        : [endingReason(game, game.fixtures.drawByRules)]),
    ];
    const described = endings.map((reason) =>
      presentation.endingDescription(reason)
    );
    for (const description of described) {
      expect(typeof description).toBe('string');
      expect(description!.trim()).not.toBe('');
    }
    expect(new Set(endings).size).toBe(endings.length);
    expect(new Set(described).size).toBe(described.length);
    for (const reason of endings)
      expect(presentation.endingLabel(reason).trim()).not.toBe('');
  });

  // regression: game-session-ending-descriptions-lost
  test('a reason the game never gives has no description', () => {
    expect(
      presentation.endingDescription(`not an ending of ${game.label}`)
    ).toBeUndefined();
  });

  // A flag fall is a draw only against a side that cannot win, which a game
  // shows by its fixture; a game without one is never drawn on time.
  if (game.fixtures.secondSideCannotWin !== undefined)
    // regression: game-session-ending-descriptions-lost
    test('a draw on time names the side that ran out', () => {
      const descriptions = (['white', 'black'] as const).map((side) => {
        const description = presentation.timeoutDrawDescription(side);
        expect(description).toContain(presentation.sideLabel(side));
        return description;
      });
      expect(descriptions[0]).not.toBe(descriptions[1]);
    });
});
