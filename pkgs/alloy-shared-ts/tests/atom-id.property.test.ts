import { describe, expect, test } from 'bun:test';
import { alloyAtomId } from '@pkgs/alloy-shared-ts/atom-id';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

/** Ids as stores hold them: uuids, emails, keys with separators, unicode. */
const atomId = fc.oneof(
  fc.string({ maxLength: 12 }),
  fc.string({ unit: 'grapheme', maxLength: 6 }),
  fc.uuid(),
  fc.emailAddress(),
  fc.stringMatching(/^[a-z_]{0,3}[-_:.][0-9a-f_]{0,3}$/)
);

/** Reads a name back to its id; a left inverse proves the encoding injective. */
function readBack(name: string): string {
  let id = '';
  let at = 'atom_'.length;
  while (at < name.length) {
    const char = name[at] ?? '';
    if (char !== '_') {
      id += char;
      at += 1;
    } else if (name[at + 1] === '_') {
      id += '_';
      at += 2;
    } else {
      const end = name.indexOf('_', at + 1);
      id += String.fromCodePoint(Number.parseInt(name.slice(at + 1, end), 16));
      at = end + 1;
    }
  }
  return id;
}

describe('alloyAtomId', () => {
  test('every id reads back from its Alloy name', () => {
    assertProperty(
      'atom id reads back',
      fc.property(atomId, (id) => {
        expect(readBack(alloyAtomId(id))).toBe(id);
      })
    );
  });

  test('different ids never share an Alloy name', () => {
    assertProperty(
      'atom id injective',
      fc.property(atomId, atomId, (a, b) => {
        fc.pre(a !== b);
        expect(alloyAtomId(a)).not.toBe(alloyAtomId(b));
      })
    );
  });

  test('every id becomes an Alloy identifier, the same one every time', () => {
    assertProperty(
      'atom id identifier',
      fc.property(atomId, (id) => {
        expect(alloyAtomId(id)).toMatch(/^atom_[A-Za-z0-9_]*$/);
        expect(alloyAtomId(id)).toBe(alloyAtomId(id));
      })
    );
  });

  test('ids that differ only in separators stay apart', () => {
    const ids = ['a-b', 'a_b', 'a__b', 'a_2d_b', 'a.b', 'a b', 'ab', 'aéb'];
    const names = ids.map(alloyAtomId);
    expect(new Set(names).size).toBe(ids.length);
    expect(alloyAtomId('s-1')).toBe('atom_s_2d_1');
  });
});
