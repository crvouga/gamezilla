import { describe, expect, test } from 'bun:test';
import { quintNames } from '@pkgs/quint/names';

const SOURCE = `// A game between two players.
module play {
  import events.* from "../play/events"

  type Color = White | Black
  type Clock = { white: int, black: int }
  type Seat =
    | Waiting
    | Seated(str)

  pure val PLAYERS: Set[str] = Set("alice", "bob")
  /// "the move", not a declaration: action fake = 1
  var toMove: Color

  pure def opponent(c: Color): Color = if (c == White) Black else White

  action init = toMove' = White
  action move(who: str): bool = {
    val next = opponent(toMove)
    toMove' = next
  }
  val invAlwaysSomeone = toMove == White or toMove == Black
}
`;

describe('quint names', () => {
  test('reads the module, its imports and its top-level vocabulary', () => {
    const names = quintNames(SOURCE);
    expect(names.module).toBe('play');
    expect(names.imports).toEqual([
      { what: 'events.*', from: '../play/events', line: 3 },
    ]);
    expect(names.declarations.map((d) => `${d.kind} ${d.name}`)).toEqual([
      'type Color',
      'variant White',
      'variant Black',
      'type Clock',
      'type Seat',
      'variant Waiting',
      'variant Seated',
      'val PLAYERS',
      'var toMove',
      'def opponent',
      'action init',
      'action move',
      'val invAlwaysSomeone',
    ]);
  });

  test('locals, parameters and comments are not vocabulary', () => {
    const names = quintNames(SOURCE).declarations.map((d) => d.name);
    expect(names).not.toContain('next');
    expect(names).not.toContain('who');
    expect(names).not.toContain('fake');
  });
});
