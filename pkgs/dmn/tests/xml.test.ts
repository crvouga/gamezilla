import { describe, expect, test } from 'bun:test';
import {
  childElements,
  parseXml,
  textOf,
  type XmlElement,
  XmlError,
} from '@pkgs/dmn/xml';

function errorOf(source: string): XmlError {
  try {
    parseXml(source);
  } catch (cause) {
    if (cause instanceof XmlError) return cause;
    throw cause;
  }
  throw new Error('parsed');
}

describe('reading XML', () => {
  test('elements, attributes in either quote, text and self-closing tags', () => {
    const root = parseXml(
      `<?xml version="1.0" encoding="UTF-8"?>\n<a x="1" y='two'>hi<b/><c>there</c></a>`
    );
    expect(root.name).toBe('a');
    expect([...root.attributes]).toEqual([
      ['x', '1'],
      ['y', 'two'],
    ]);
    expect(textOf(root)).toBe('hi');
    expect(childElements(root).map((c) => c.name)).toEqual(['b', 'c']);
    const [, c] = childElements(root);
    expect(textOf(c as XmlElement)).toBe('there');
  });

  test('a prefixed name keeps its prefix and exposes its local name', () => {
    const root = parseXml(
      '<dmn:definitions xmlns:dmn="urn:x"><dmn:decision/></dmn:definitions>'
    );
    expect(root.prefix).toBe('dmn');
    expect(root.localName).toBe('definitions');
    expect(childElements(root, 'decision')).toHaveLength(1);
  });

  test('entities, character references and CDATA read as their text', () => {
    const root = parseXml(
      '<t a="&lt;&amp;&#65;">&lt; 20 &amp; &gt;= 5 &quot;x&quot; &apos;y&apos; &#x41;&#66;<![CDATA[<raw & "as is">]]></t>'
    );
    expect(root.attributes.get('a')).toBe('<&A');
    expect(textOf(root)).toBe(`< 20 & >= 5 "x" 'y' AB<raw & "as is">`);
  });

  test('comments are skipped, before, inside and after the root', () => {
    const root = parseXml('<!-- a --><r>1<!-- b -->2</r><!-- c -->\n');
    expect(textOf(root)).toBe('12');
  });

  test('line endings are normalized and literal whitespace in attributes becomes spaces', () => {
    const root = parseXml('<r a="x\ty\r\nz">1\r\n2</r>');
    expect(root.attributes.get('a')).toBe('x y z');
    expect(textOf(root)).toBe('1\n2');
  });

  test('a byte order mark is allowed', () => {
    expect(parseXml('\uFEFF<r/>').name).toBe('r');
  });
});

describe('refusing XML', () => {
  const cases: readonly [string, string, string][] = [
    [
      'a DOCTYPE',
      '<!DOCTYPE r [<!ENTITY x "y">]><r/>',
      'DOCTYPE is not allowed',
    ],
    ['an unknown entity', '<r>&nbsp;</r>', 'unknown entity &nbsp;'],
    ['an unclosed element', '<r><a></r>', '</r> closes <a>'],
    ['a missing end', '<r>', 'element <r> is not closed'],
    ['a repeated attribute', '<r a="1" a="2"/>', 'attribute a is repeated'],
    ['text after the root', '<r/>x', 'content after the root element'],
    ['two roots', '<r/><s/>', 'content after the root element'],
    ['a processing instruction', '<r><?pi x?></r>', 'processing instructions'],
    ['"<" in an attribute', '<r a="<"/>', '"<" is not allowed'],
    ['an unquoted attribute', '<r a=1/>', 'expected a quoted value'],
    ['"--" in a comment', '<r><!-- a -- b --></r>', '"--" is not allowed'],
    [
      'a forbidden character',
      '<r>\u0001</r>',
      'a character XML does not allow',
    ],
    [
      'a reference to a forbidden character',
      '<r>&#0;</r>',
      'is not a character XML allows',
    ],
    ['an empty document', '  ', 'expected the root element'],
  ];
  for (const [what, source, message] of cases) {
    test(what, () => {
      expect(errorOf(source).message).toContain(message);
    });
  }

  test('an error names its line and column', () => {
    const error = errorOf('<r>\n  <a>\n    &bogus;\n  </a>\n</r>');
    expect([error.line, error.column]).toEqual([3, 5]);
    expect(error.message).toStartWith('3:5: unknown entity');
  });
});
