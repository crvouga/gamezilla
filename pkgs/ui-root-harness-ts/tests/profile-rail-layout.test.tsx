/**
 * A profile with a rail composes as a page, not three ragged columns: the
 * identity is one band across the top, the main sections take the wide
 * column, and the rail (friends, settings) is a column wide enough for its
 * rows' captions on one line.
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

// regression: profile-desktop-ragged-columns
test('a wide profile with a rail is a band over a flexible main column and a rail wide enough for one-line captions', () => {
  const css = readFileSync(LAYOUTS_CSS, 'utf8');
  const grid = rule(css, '  .profile[data-rail="true"]');
  // The main column flexes (its rows never truncate to fit a third
  // column); the rail is fixed at a width that holds "Account, appearance,
  // sound and more" on one line.
  expect(grid).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) 24rem;/);
  expect(grid).toMatch(/align-items:\s*start;/);
  expect(rule(css, '  .profile[data-rail="true"] > .profileAside')).toMatch(
    /grid-column:\s*1 \/ -1;/
  );
  expect(
    rule(css, '  .profile[data-rail="true"] > .profileAside > .identity')
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
test('on desktop the identity is a band across the column, edge to edge with the columns below', () => {
  const css = readFileSync(LAYOUTS_CSS, 'utf8');
  const selector = '.profile[data-rail="true"] > .profileAside > .identity';
  // The wide rule is the last one for this selector (inside the container
  // query); it stretches instead of shrinking to its content.
  const start = css.lastIndexOf(`${selector} {`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  expect(body).toContain('align-self: stretch');
  expect(body).not.toContain('fit-content');
});
