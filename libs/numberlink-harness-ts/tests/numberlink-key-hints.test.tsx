/** @jsxImportSource solid-js */

import { expect, test } from 'bun:test';
import { initialNumberlinkDefinition } from '@libs/numberlink-client-ts/numberlink-editor-actions';
import { NumberlinkPlayer } from '@libs/numberlink-client-ts/numberlink-player';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';

function mount(width: number) {
  return renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 900 }}>
      <NumberlinkPlayer
        definition={initialNumberlinkDefinition()}
        state={'{"paths":[]}'}
        disabled={false}
        onAction={() => undefined}
      />
    </ThemeProvider>
  ));
}

// regression: numberlink-key-instructions-paragraph — wide, how to draw by
// keyboard was a dense two-line paragraph under the board ("…or press
// Enter on a number, draw with the arrow keys and press Enter again.
// Escape cancels; Delete removes a path."). It is now one compact hint:
// the pointer's way in words, then each key cap beside what it does.
test('wide, the keyboard hint is key caps beside short labels, not a paragraph', () => {
  const view = mount(1440);
  try {
    const hint = view.getByTestId('numberlink-key-hints');
    expect(hint.getAttribute('data-component')).toBe('KeyHints');
    const keys = [...hint.querySelectorAll('kbd')].map(
      (key) => key.textContent
    );
    expect(keys).toEqual(['Enter', 'Arrows', 'Esc', 'Del']);
    expect(hint.textContent).toContain('Drag from a number to its match.');
    expect(hint.textContent).not.toContain('press Enter again');
  } finally {
    view.unmount();
  }
});

// regression: numberlink-hint-wording-differs — wide, the hint read "Drag a
// number to its match." while a phone said "Drag from a number to its match
// to draw a path.": two wordings for one gesture. Both now say "Drag from a
// number to its match."; wide adds only the keys.
test('on a phone the hint is the drag alone, in the words a wide screen uses', () => {
  const view = mount(390);
  try {
    expect(view.queryByTestId('numberlink-key-hints')).toBeNull();
    expect(view.getByText('Drag from a number to its match.')).toBeDefined();
  } finally {
    view.unmount();
  }
});
