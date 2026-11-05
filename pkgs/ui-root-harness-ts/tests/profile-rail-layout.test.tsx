/**
 * A profile with a rail composes as a page, not three ragged columns: on a
 * desktop the identity is a card of its own content in a narrow first
 * column, the main sections take what is left, and the rail (friends,
 * settings) is a column wide enough for its rows' captions on one line; a
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
// was a 960px band with the face and facts squeezed at its start, Edit
// profile at its far end and about 600px of nothing between. It is now a
// card of its own content in a narrow first column, level with the main
// sections and the rail.
test('a desktop profile with a rail is an identity card, a flexible main column and a rail wide enough for one-line captions', () => {
  const css = readFileSync(LAYOUTS_CSS, 'utf8');
  const grid = ruleIn(css, DESKTOP, '  .profile[data-rail="true"]');
  // The main column flexes (its rows never truncate to fit a third
  // column); the rail is fixed at a width that holds "Account, appearance,
  // sound and more" on one line; the identity column is as narrow as a
  // picture over a name.
  expect(grid).toMatch(
    /grid-template-columns:\s*13rem minmax\(0, 1fr\) 23rem;/
  );
  expect(grid).toMatch(/align-items:\s*start;/);
  const card = ruleIn(
    css,
    DESKTOP,
    '  .profile[data-rail="true"] > .profileAside > .identity'
  );
  expect(card).toMatch(/flex-direction:\s*column;/);
  expect(card).toMatch(/align-items:\s*center;/);
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

// regression: profile-identity-card-narrower-than-columns
test('on desktop the identity card fills its own column, edge to edge with it', () => {
  const css = readFileSync(LAYOUTS_CSS, 'utf8');
  const body = ruleIn(
    css,
    DESKTOP,
    '  .profile[data-rail="true"] > .profileAside > .identity'
  );
  // It stretches to its column's edges instead of shrinking to its words.
  expect(body).toContain('align-self: stretch');
  expect(body).not.toContain('fit-content');
});
