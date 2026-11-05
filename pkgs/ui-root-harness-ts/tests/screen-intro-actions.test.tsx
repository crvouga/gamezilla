/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { ScreenIntro } from '@pkgs/ui-root-client-ts/screen-intro';
import { mustQuery, renderUi } from './render';

describe('ScreenIntro actions', () => {
  test("a screen's own commands sit at its title, after the words", () => {
    renderUi(() => (
      <ScreenIntro
        title="Counting"
        subtitle="Play or build."
        actions={<button type="button">Create puzzle</button>}
      />
    ));
    const intro = mustQuery('[data-component="ScreenIntro"]');
    const actions = mustQuery('[data-component="ScreenIntroActions"]');
    expect(intro.lastElementChild).toBe(actions);
    expect(actions.textContent).toBe('Create puzzle');
    // Beside the words where they fit, under them where they do not.
    expect(intro.className).toContain('flex-row');
    expect(intro.className).toContain('flex-wrap');
    expect(intro.querySelector('h1')?.textContent).toBe('Counting');
  });

  test('without actions the title block is unchanged', () => {
    renderUi(() => <ScreenIntro title="Counting" subtitle="Play or build." />);
    const intro = mustQuery('[data-component="ScreenIntro"]');
    expect(
      document.querySelector('[data-component="ScreenIntroActions"]')
    ).toBeNull();
    expect(intro.className).not.toContain('flex-row');
    expect(intro.firstElementChild?.tagName).toBe('H1');
  });
});
