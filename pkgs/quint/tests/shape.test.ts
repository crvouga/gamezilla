import { describe, expect, test } from 'bun:test';

import {
  formatModelShapeIssue,
  type ModelShapeCode,
  modelShapeIssues,
} from '@pkgs/quint/shape';

const SOUND = `
// Alice and Bob each have a tally. Without a connection, one's own add waits.
module tally_shape {
  type Person = str
  pure val PEOPLE: Set[Person] = Set("alice", "bob")
  var tally: int
  var _offline: Set[Person]
  var _tallyAtCutOff: int

  action init = all {
    tally' = 0,
    _offline' = Set(),
    _tallyAtCutOff' = 0,
  }

  action addOne(person: Person): bool = all {
    not(_offline.contains(person)),
    tally' = tally + 1,
    _offline' = _offline,
    _tallyAtCutOff' = tally + 1,
  }

  action _loseConnection(person: Person): bool = all {
    not(_offline.contains(person)),
    tally' = tally,
    _offline' = _offline.union(Set(person)),
    _tallyAtCutOff' = tally,
  }

  action _connectionReturns: bool = all {
    _offline != Set(),
    tally' = tally,
    _offline' = Set(),
    _tallyAtCutOff' = _tallyAtCutOff,
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    any { addOne(person), _loseConnection(person), _connectionReturns }
  }

  val invOfflineKeepsTally = PEOPLE.forall(p =>
    _offline.contains(p) implies tally == _tallyAtCutOff
  )
}
`;

function codes(source: string, fileName = 'tally-shape.qnt'): ModelShapeCode[] {
  return modelShapeIssues(source, fileName).map((found) => found.code);
}

describe('modelShapeIssues', () => {
  test('a model that loses and regains one device at a time passes', () => {
    expect(modelShapeIssues(SOUND, 'tally-shape.qnt')).toEqual([]);
  });

  test('init that passes an empty set into a helper still starts connected', () => {
    const source = SOUND.replace(
      `action init = all {
    tally' = 0,
    _offline' = Set(),
    _tallyAtCutOff' = 0,
  }`,
      `action _boot(newOffline: Set[Person]): bool = all {
    tally' = 0,
    _offline' = newOffline,
    _tallyAtCutOff' = 0,
  }

  action init = _boot(Set())`
    );
    expect(modelShapeIssues(source, 'tally-shape.qnt')).toEqual([]);
    const seeded = source.replace('_boot(Set())', '_boot(PEOPLE)');
    expect(codes(seeded)).toContain('starts-offline');
  });

  test('published events are not an aggregate', () => {
    expect(
      modelShapeIssues('module events {\n}\n', 'specs/friends/events.qnt')
    ).toEqual([]);
  });

  test('names the missing connection when nothing models it', () => {
    const source = SOUND.replaceAll('_offline', '_spare')
      .replaceAll('_loseConnection', '_pause')
      .replaceAll('_connectionReturns', '_resume');
    expect(codes(source)).toContain('no-connectivity');
  });

  test('refuses an invariant that cannot fail, and a variable init never sets', () => {
    const source = SOUND.replace(
      'val invOfflineKeepsTally = PEOPLE.forall(p =>\n    _offline.contains(p) implies tally == _tallyAtCutOff\n  )',
      'val invAlways = true'
    ).replace("    _tallyAtCutOff' = 0,\n", '');
    expect(codes(source)).toEqual(
      expect.arrayContaining([
        'trivial-invariant',
        'var-uninitialized',
        'no-coupling-invariant',
      ])
    );
  });

  test('an action step never calls is unreachable, and so is a connection it drops for everyone', () => {
    const source = SOUND.replace(
      "_offline' = _offline.union(Set(person))",
      "_offline' = PEOPLE"
    ).replace(
      'any { addOne(person), _loseConnection(person), _connectionReturns }',
      'any { addOne(person), _connectionReturns }'
    );
    expect(codes(source)).toEqual(
      expect.arrayContaining(['unreachable-action', 'no-disconnect'])
    );
  });

  test('a single bool is one device; a set that drops every device is not', () => {
    const dropped = SOUND.replace(
      "_offline' = _offline.union(Set(person))",
      "_offline' = PEOPLE"
    );
    expect(codes(dropped)).toContain('disconnect-drops-everyone');
  });

  test('formats one line a gate can print', () => {
    const [first] = modelShapeIssues(
      SOUND.replace('module tally_shape', 'module other'),
      'tally-shape.qnt'
    );
    expect(first).toBeDefined();
    if (first === undefined) return;
    expect(
      formatModelShapeIssue('specs/room/tally-shape.qnt', first)
    ).toContain('[module-name]');
  });
});
