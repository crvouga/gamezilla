import { describe, expect, test } from 'bun:test';
import { escapeXml, parseXml, textOf } from '@pkgs/dmn-shared-ts/xml';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

function isXmlChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  const control = code < 0x20 && code !== 0x9 && code !== 0xa && code !== 0xd;
  return !control && code !== 0xfffe && code !== 0xffff;
}

/** Any text XML can carry: no forbidden control characters or non-characters. */
const xmlText = fc
  .string({ unit: 'grapheme', maxLength: 30 })
  .filter((s) => [...s].every(isXmlChar) && s.isWellFormed());

describe('escaping', () => {
  test('any text escaped into an element or an attribute reads back unchanged', () => {
    assertProperty(
      'escape round trip',
      fc.property(xmlText, xmlText, (inside, attribute) => {
        const root = parseXml(
          `<r a="${escapeXml(attribute)}" b='${escapeXml(attribute)}'>${escapeXml(inside)}</r>`
        );
        expect(textOf(root)).toBe(inside);
        expect(root.attributes.get('a')).toBe(attribute);
        expect(root.attributes.get('b')).toBe(attribute);
      })
    );
  });

  test('escaped text survives CDATA-like and comment-like content', () => {
    const tricky = ']]> <!-- --> <![CDATA[ & ; &amp;';
    expect(textOf(parseXml(`<r>${escapeXml(tricky)}</r>`))).toBe(tricky);
  });
});
