/**
 * A profile with a rail composes as a page, not ragged columns: on a
 * desktop the identity is the page's own header over two columns whose
 * tops are level, the main sections taking what is left and the rail
 * (friends, settings) wide enough for its rows' captions on one line; a
 * tablet's column draws the identity as one band across the top.
 */

import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ProfileScreenLayout } from '@pkgs/ui-root-client-ts/profile-screen-layout';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup } from '@solidjs/testing-library';

afterEach(cleanup);

const LAYOUTS_CSS = join(
  import.meta.dirname,
  '../../ui-root-client-ts/src/screen-layouts.module.css'
);

/** The body of the first rule whose selector is exactly `selector`. */
function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule ${selector}`);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

function renderProfile(withRail: boolean): HTMLElement {
  const { container } = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 1440, height: 900 }}
    >
      <ProfileScreenLayout
        screenId="profile-rail"
        breadcrumbs={[{ name: 'Profile' }]}
        avatar={<span>face</span>}
        identity={<span>@avery</span>}
        identityActions={<button type="button">Edit profile</button>}
        rail={withRail ? <span>Settings</span> : undefined}
      >
        <span>Playing now</span>
      </ProfileScreenLayout>
    </ThemeProvider>
  ));
  return container;
}

/** The body of the rule for `selector` inside the container query `query`. */
function ruleIn(css: string, query: string, selector: string): string {
  const block = css.indexOf(`@container ${query} {`);
  if (block < 0) throw new Error(`no query ${query}`);
  return rule(css.slice(block), selector);
}

const DESKTOP = '(min-width: 56rem)';
const TABLET = '(min-width: 40rem) and (max-width: 55.99rem)';

// regression: profile-desktop-ragged-columns
// regression: profile-header-band-mostly-empty — on a desktop the identity
// was a 960px framed band with the face and facts squeezed at its start,
// Edit profile at its far end and about 600px of nothing between.
// regression: profile-desktop-l-shaped-gap — it then became a 208px card in
// a first column of three, each a different height, leaving a large
// L-shaped empty area under the card and the main section. The identity is
// now the page's own unframed header with Edit profile right after the
// words, over two columns whose tops are on one line.
test('a desktop profile with a rail is an identity header over a flexible main column and a rail wide enough for one-line captions', () => {
  const css = readFileSync(LAYOUTS_CSS, 'utf8');
  const grid = ruleIn(css, DESKTOP, '  .profile[data-rail="true"]');
  // The main column flexes (its rows never truncate to fit beside the
  // rail); the rail is fixed at a width that holds "Account, appearance,
  // sound and more" on one line. Two columns, never three.
  expect(grid).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) 23rem;/);
  expect(grid).toMatch(/align-items:\s*start;/);
  // The identity spans both columns, above them.
  expect(
    ruleIn(css, DESKTOP, '  .profile[data-rail="true"] > .profileAside')
  ).toMatch(/grid-column:\s*1 \/ -1;/);
  const header = ruleIn(
    css,
    DESKTOP,
    '  .profile[data-rail="true"] > .profileAside > .identity'
  );
  // One row, unframed: no panel to run empty past the words.
  expect(header).toMatch(/flex-direction:\s*row;/);
  expect(header).toMatch(/border:\s*0;/);
  expect(header).toMatch(/background:\s*transparent;/);
  expect(header).toMatch(/padding:\s*0;/);
  // The words take their own width, so Edit profile follows them rather
  // than standing at the column's far end.
  const words = ruleIn(
    css,
    DESKTOP,
    '  .profile[data-rail="true"] > .profileAside > .identity > .identityText'
  );
  expect(words).toMatch(/flex:\s*0 1 auto;/);
  // A tablet's column still draws the band across the top.
  expect(
    ruleIn(
      css,
      TABLET,
      '  .profile[data-rail="true"] > .profileAside > .identity'
    )
  ).toMatch(/flex-direction:\s*row;/);
});

test('a profile with a rail draws its identity apart from the picture and the rail after the main sections', () => {
  const container = renderProfile(true);
  const frame = container.querySelector('[data-rail]');
  expect(frame?.getAttribute('data-rail')).toBe('true');
  expect(frame?.getAttribute('data-split')).toBe('false');
  const text = frame?.textContent ?? '';
  expect(text.indexOf('face')).toBeLessThan(text.indexOf('@avery'));
  expect(text.indexOf('Playing now')).toBeLessThan(text.indexOf('Settings'));
});

test('a profile without a rail keeps the identity card beside its sections', () => {
  const container = renderProfile(false);
  const frame = container.querySelector('[data-rail]');
  expect(frame?.getAttribute('data-rail')).toBe('false');
  expect(frame?.getAttribute('data-split')).toBe('true');
});

// regression: profile-identity-card-narrower-than-columns — the desktop
// identity card once shrank to its words inside its column. The identity
// is now a header spanning both columns; its block is never held to its
// content's width.
test('on desktop the identity spans the columns under it', () => {
  const css = readFileSync(LAYOUTS_CSS, 'utf8');
  const aside = ruleIn(css, DESKTOP, '  .profile[data-rail="true"] > .profileAside');
  expect(aside).toMatch(/grid-column:\s*1 \/ -1;/);
  const body = ruleIn(
    css,
    DESKTOP,
    '  .profile[data-rail="true"] > .profileAside > .identity'
  );
  expect(body).not.toContain('fit-content');
});
