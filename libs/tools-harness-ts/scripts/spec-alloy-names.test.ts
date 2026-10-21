import { describe, expect, test } from 'bun:test';
import { alloyNames } from './spec-alloy-names';

describe('alloyNames', () => {
  test('sigs of every form and their fields, with lines', () => {
    const source = [
      '// sig Commented { ghost: set Nothing }',
      'sig Username {}',
      'abstract sig OutsideAccount {',
      '  // the account it signs into',
      '  signsInto: lone Account',
      '}',
      'one sig Google, Apple extends OutsideAccount {}',
      'sig Person {',
      '  friend, friendRequests: set Person,',
      '  var blocks: Person -> lone Person,',
      '  /* a block comment: with a colon */',
      '  _helper: set Person',
      '}',
      'fact NoSelf { no iden & friend }',
    ].join('\n');
    expect(alloyNames(source)).toEqual([
      { name: 'Username', kind: 'sig', line: 2 },
      { name: 'OutsideAccount', kind: 'sig', line: 3 },
      { name: 'signsInto', kind: 'field', line: 5 },
      { name: 'Google', kind: 'sig', line: 7 },
      { name: 'Apple', kind: 'sig', line: 7 },
      { name: 'Person', kind: 'sig', line: 8 },
      { name: 'friend', kind: 'field', line: 9 },
      { name: 'friendRequests', kind: 'field', line: 9 },
      { name: 'blocks', kind: 'field', line: 10 },
      { name: '_helper', kind: 'field', line: 12 },
    ]);
  });

  test('facts, predicates and assertions declare no names', () => {
    expect(
      alloyNames(
        'pred p[x: Person] { x in x }\nassert A { all p: Person | p = p }\nrun {} for 3'
      )
    ).toEqual([]);
  });
});
