/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KeyHints } from '@pkgs/ui-root-client-ts/key-hints';
import { mustQuery, renderUi } from './render';

describe('KeyHints', () => {
  test('says the pointer way first, then each key cap beside what it does', () => {
    renderUi(() => (
      <KeyHints
        lead="Drag from a number to its match."
        hints={[
          { keys: ['Enter'], label: 'start' },
          { keys: ['Esc'], label: 'cancel' },
        ]}
      />
    ));
    const hints = mustQuery('[data-component="KeyHints"]');
    expect(hints.tagName).toBe('P');
    expect(hints.className).toContain('textCaption');
    expect(
      [...hints.querySelectorAll('kbd')].map((key) => key.textContent)
    ).toEqual(['Enter', 'Esc']);
    expect(hints.textContent).toBe(
      'Drag from a number to its match.EnterstartEsccancel'
    );
  });

  test('the words take a line of their own, so the keys share one line', () => {
    const css = readFileSync(
      join(
        import.meta.dirname,
        '../../ui-root-client-ts/src/key-hints/key-hints.module.css'
      ),
      'utf8'
    );
    const lead = css.slice(
      css.indexOf('.lead {'),
      css.indexOf('}', css.indexOf('.lead {'))
    );
    expect(lead).toMatch(/flex-basis:\s*100%;/);
  });
});
