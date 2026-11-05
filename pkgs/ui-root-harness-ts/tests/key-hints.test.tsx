/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { KeyHints } from '@pkgs/ui-root-client-ts/key-hints';
import { mustQuery, renderUi } from './render';

describe('KeyHints', () => {
  test('says the pointer way first, then each key cap beside what it does', () => {
    renderUi(() => (
      <KeyHints
        lead="Drag from a number to its match."
        hints={[
          { keys: ['↵'], label: 'start' },
          { keys: ['Esc'], label: 'cancel' },
        ]}
      />
    ));
    const hints = mustQuery('[data-component="KeyHints"]');
    expect(hints.tagName).toBe('P');
    expect(hints.className).toContain('textCaption');
    expect(
      [...hints.querySelectorAll('kbd')].map((key) => key.textContent)
    ).toEqual(['↵', 'Esc']);
    expect(hints.textContent).toBe(
      'Drag from a number to its match.↵startEsccancel'
    );
  });
});
