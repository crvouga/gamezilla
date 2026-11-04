/** @jsxImportSource solid-js */
/** What the space's top bar offers on a phone and beside the sidebar. */

import { afterEach, expect, test } from 'bun:test';
import {
  SpaceChromeLeadingActionBar,
  SpaceChromeTrailingActionBar,
} from '@libs/spaces-client-ts/space-chrome-action-bar';
import { SpacePresenceStripView } from '@libs/spaces-client-ts/space-presence-strip-view';
import {
  AVERY,
  faces,
  GUESTS,
} from '@libs/spaces-client-ts/spaces-story.example';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

afterEach(cleanup);

const PHONE = { width: 390, height: 844 };
const WIDE = { width: 1280, height: 800 };

const CALLBACKS = {
  onPressHome: () => undefined,
  onPressBack: () => undefined,
  onPressMembers: () => undefined,
  onPressShare: () => undefined,
  onPressRename: () => undefined,
  onPressEnd: () => undefined,
  onPressLeave: () => undefined,
};

function renderBar(
  layout: { width: number; height: number },
  canEnd: boolean,
  back: () => (() => void) | null = () => CALLBACKS.onPressBack
): HTMLElement {
  const harness = createHarnessClock();
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider colorScheme="dark" fixedLayout={layout}>
        <SurfaceStackProvider>
          <SpaceChromeLeadingActionBar
            {...CALLBACKS}
            onPressBack={back()}
            backLabel="Games"
          />
          <SpaceChromeTrailingActionBar
            canRename
            canEnd={canEnd}
            presence={(size) => (
              <SpacePresenceStripView
                faces={faces([AVERY, ...GUESTS])}
                size={size}
              />
            )}
            callbacks={{
              ...CALLBACKS,
              get onPressBack() {
                return back();
              },
              backLabel: 'Games',
            }}
          />
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return container;
}

function byHandle(container: HTMLElement, handle: string): Element | null {
  return container.querySelector(`[data-testid="${handle}"]`);
}

function openMenu(container: HTMLElement): void {
  const trigger = byHandle(container, Handles.spaceChromeOverflow);
  if (!(trigger instanceof HTMLElement)) throw new Error('no ⋯ menu');
  fireEvent.click(trigger);
}

function inPage(handle: string): Element | null {
  return document.querySelector(`[data-testid="${handle}"]`);
}

// regression: space-close-label-hides-step-out
test('beside the sidebar Minimize and Back say what they do, side by side', () => {
  const container = renderBar(WIDE, true);
  const minimize = byHandle(container, Handles.spaceClose);
  expect(minimize?.textContent).toContain('Minimize');
  expect(minimize?.getAttribute('aria-label')).toBe('Minimize space');
  expect(minimize?.textContent).not.toContain('Close');
  expect(byHandle(container, Handles.navBack)?.textContent).toContain('Games');
});

// regression: space-close-label-hides-step-out
test("on a phone without Back, the bar's one glyph is Minimize, named so", () => {
  const container = renderBar(PHONE, true, () => null);
  expect(
    byHandle(container, Handles.spaceClose)?.getAttribute('aria-label')
  ).toBe('Minimize space');
  expect(byHandle(container, Handles.navBack)).toBeNull();
  openMenu(container);
  // Once on the bar, never a second time in ⋯.
  expect(
    document.querySelectorAll(`[data-testid="${Handles.spaceClose}"]`).length
  ).toBe(1);
});

// regression: space-close-label-hides-step-out
// regression: space-phone-bar-crowds-title
test("on a phone showing Back, the bar's one glyph is Back and Minimize leads ⋯", () => {
  const container = renderBar(PHONE, true);
  expect(byHandle(container, Handles.navBack)?.getAttribute('aria-label')).toBe(
    'Games'
  );
  // No second chevron beside Back to crowd the room's name.
  expect(byHandle(container, Handles.spaceClose)).toBeNull();
  openMenu(container);
  const minimize = inPage(Handles.spaceClose);
  expect(minimize?.textContent).toContain('Minimize space');
  expect(minimize?.textContent).not.toContain('Close');
  // The first item, before Share.
  const items = [
    ...document.querySelectorAll(
      `[data-testid="${Handles.spaceClose}"], [data-testid="${Handles.spaceShare}"]`
    ),
  ];
  expect(items[0]).toBe(minimize ?? undefined);
});

// regression: space-phone-bar-crowds-title
test('the members button keeps its element while Back comes and goes', () => {
  const [back, setBack] = createSignal<(() => void) | null>(null);
  const container = renderBar(PHONE, true, back);
  const before = byHandle(container, Handles.spaceMembersButton);
  expect(before).not.toBeNull();
  setBack(() => () => undefined);
  expect(byHandle(container, Handles.navBack)).not.toBeNull();
  expect(byHandle(container, Handles.spaceMembersButton)).toBe(before);
  setBack(null);
  expect(byHandle(container, Handles.spaceClose)).not.toBeNull();
  expect(byHandle(container, Handles.spaceMembersButton)).toBe(before);
});

// regression: space-end-beside-everyday-controls
test('End and Leave never sit on the bar beside everyday controls', () => {
  for (const layout of [PHONE, WIDE]) {
    for (const canEnd of [true, false]) {
      const container = renderBar(layout, canEnd);
      expect(byHandle(container, Handles.spaceEnd)).toBeNull();
      expect(byHandle(container, Handles.spaceLeave)).toBeNull();
      expect(byHandle(container, Handles.spaceMembersButton)).not.toBeNull();
      cleanup();
    }
  }
});

// regression: space-end-beside-everyday-controls
test('the host finds End and Leave in ⋯, in red, after a divider', () => {
  for (const layout of [PHONE, WIDE]) {
    openMenu(renderBar(layout, true));
    const end = inPage(Handles.spaceEnd);
    const leave = inPage(Handles.spaceLeave);
    expect(end?.textContent).toContain('End space');
    expect(leave?.textContent).toContain('Leave space');
    expect(end?.querySelector('.text-destructive')).not.toBeNull();
    expect(leave?.querySelector('.text-destructive')).not.toBeNull();
    // Everyday actions first, then a divider, then the ways out.
    const rename = inPage(Handles.spaceRename);
    const divider = rename?.nextElementSibling;
    expect(divider?.getAttribute('role')).toBe('separator');
    expect(divider?.nextElementSibling).toBe(leave);
    expect(leave?.nextElementSibling).toBe(end);
    cleanup();
  }
});

test('a guest finds Leave in ⋯, and no End', () => {
  openMenu(renderBar(WIDE, false));
  expect(inPage(Handles.spaceLeave)?.textContent).toContain('Leave space');
  expect(inPage(Handles.spaceEnd)).toBeNull();
});

test('the members button draws no ring of its own around the faces', () => {
  const container = renderBar(WIDE, true);
  expect(
    byHandle(container, Handles.spaceMembersButton)?.getAttribute(
      'data-variant'
    )
  ).toBe('faces');
});
