/**
 * Relations the accessible name computation keeps on random names and
 * contents (AccName 1.2 § 4.3.2): the precedence of its sources, hidden
 * content never speaking, and whitespace normalization.
 */

import { describe, expect, test } from 'bun:test';
import {
  accessibleName,
  normalizeName,
} from '@pkgs/a11y-shared-ts/accessible-name';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { page } from './dom';

const text = fc
  .array(fc.constantFrom('a', 'b', 'Z', 'é', '1', ' ', '\t', '\n'), {
    maxLength: 12,
  })
  .map((chars) => chars.join(''));

const spoken = text.filter((value) => value.trim().length > 0);

/** A button holding `content` as text, and a separate labelling span. */
function button(content: string): { document: Document; button: Element } {
  const document = page();
  const element = document.createElement('button');
  element.textContent = content;
  document.body.appendChild(element);
  return { document, button: element };
}

describe('accessible name (property)', () => {
  test('a non-blank aria-label is the name, whatever the content', () => {
    assertProperty(
      'aria-label wins',
      fc.property(spoken, text, (label, content) => {
        const { button: element } = button(content);
        element.setAttribute('aria-label', label);
        expect(accessibleName(element)).toBe(normalizeName(label));
      })
    );
  });

  test('aria-labelledby wins over aria-label and content', () => {
    assertProperty(
      'aria-labelledby wins',
      fc.property(spoken, text, text, (referenced, label, content) => {
        const { document, button: element } = button(content);
        const span = document.createElement('span');
        span.id = 'ref';
        span.textContent = referenced;
        document.body.appendChild(span);
        element.setAttribute('aria-labelledby', 'ref');
        element.setAttribute('aria-label', label);
        expect(accessibleName(element)).toBe(normalizeName(referenced));
      })
    );
  });

  test('hidden content never adds to the name', () => {
    assertProperty(
      'hidden content silent',
      fc.property(
        text,
        spoken,
        fc.constantFrom('hidden', 'aria-hidden', 'style'),
        (content, secret, how) => {
          const { document, button: element } = button(content);
          const before = accessibleName(element);
          const span = document.createElement('span');
          span.textContent = secret;
          if (how === 'hidden') span.setAttribute('hidden', '');
          if (how === 'aria-hidden') span.setAttribute('aria-hidden', 'true');
          if (how === 'style') span.setAttribute('style', 'display:none');
          element.appendChild(span);
          expect(accessibleName(element)).toBe(before);
        }
      )
    );
  });

  test('the name is normalized: no leading, trailing or repeated whitespace', () => {
    assertProperty(
      'normalized',
      fc.property(text, text, (content, title) => {
        const { button: element } = button(content);
        element.setAttribute('title', title);
        const name = accessibleName(element);
        expect(normalizeName(name)).toBe(name);
        expect(name).toBe(
          normalizeName(content).length > 0
            ? normalizeName(content)
            : normalizeName(title)
        );
      })
    );
  });
});
