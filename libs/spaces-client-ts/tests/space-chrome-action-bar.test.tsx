/** @jsxImportSource solid-js */
/** What the space's top bar offers on a phone and beside the sidebar. */

import { afterEach, expect, test } from 'bun:test';
import { SpaceChromeTrailingActionBar } from '@libs/spaces-client-ts/space-chrome-action-bar';
import {
  SpaceChromeBack,
  SpaceChromeCompactTitle,
  type SpaceChromeNavProps,
  SpaceChromeTrail,
} from '@libs/spaces-client-ts/space-chrome-nav';
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
import { createSignal, Show } from 'solid-js';

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

type Where = {
  /** The selected game, or none on the space's list of games. */
  readonly place?: string | undefined;
  /** Where Back goes, as the screen names it. */
  readonly backLabel?: string | undefined;
};

const ROOM = 'Friday game night';

function renderBar(
  layout: { width: number; height: number },
  canEnd: boolean,
  back: () => (() => void) | null = () => CALLBACKS.onPressBack,
  where: Where = { place: 'Chess', backLabel: 'Games' }
): HTMLElement {
  const harness = createHarnessClock();
  const nav = (): SpaceChromeNavProps => ({
    title: ROOM,
    spaceId: 'space-1',
    place: where.place,
    onPressBack: back(),
    backLabel: where.backLabel,
  });
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider colorScheme="dark" fixedLayout={layout}>
        <SurfaceStackProvider>
          <Show
            when={layout.width >= WIDE.width}
            fallback={
              <>
                <SpaceChromeBack {...nav()} />
                <SpaceChromeCompactTitle {...nav()} />
              </>
            }
          >
            <SpaceChromeTrail {...nav()} />
          </Show>
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
              backLabel: where.backLabel,
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

/** Minimize, wherever the row put it: on the bar, or in ⋯. */
function minimizeControls(container: HTMLElement): Element[] {
  if (byHandle(container, Handles.spaceClose) === null) openMenu(container);
  return [
    ...document.querySelectorAll(`[data-testid="${Handles.spaceClose}"]`),
  ];
}

// regression: space-bar-competing-nav-controls
test('beside the sidebar the bar is one trail, the room its way back from a game’s menu', () => {
  const container = renderBar(WIDE, true);
  const back = byHandle(container, Handles.navBack);
  const room = byHandle(container, Handles.spaceTitle);
  expect(room?.textContent).toBe(ROOM);
  // The room's tile is a mark beside its name, hidden from assistive tech.
  expect(back?.contains(room)).toBe(true);
  const current = container.querySelector('[aria-current="page"]');
  expect(current?.textContent).toBe('Chess');
  // One way back, never a second "‹ Games" beside the trail.
  expect(
    container.querySelectorAll(`[data-testid="${Handles.navBack}"]`).length
  ).toBe(1);
  expect(container.textContent).not.toContain('Games');
});

// regression: space-bar-competing-nav-controls
test('on a screen a game opens, the game is the way back and the room is plain', () => {
  const container = renderBar(WIDE, true, undefined, {
    place: 'Chess',
    backLabel: 'Chess',
  });
  expect(byHandle(container, Handles.navBack)?.textContent).toBe('Chess');
  const room = byHandle(container, Handles.spaceTitle);
  expect(room?.closest('button')).toBeNull();
});

// regression: space-bar-competing-nav-controls
test('on the list of games the room is where you are, with no way back', () => {
  const container = renderBar(WIDE, true, () => null, {});
  expect(byHandle(container, Handles.navBack)).toBeNull();
  const current = container.querySelector('[aria-current="page"]');
  expect(current?.contains(byHandle(container, Handles.spaceTitle))).toBe(true);
});

// regression: space-close-label-hides-step-out
// regression: space-bar-competing-nav-controls
test('Minimize is its own control at the far edge, named so, never Close', () => {
  for (const layout of [WIDE, PHONE]) {
    const container = renderBar(layout, true);
    const minimize = minimizeControls(container);
    expect(minimize.length).toBe(1);
    const control = minimize[0];
    const name =
      control?.getAttribute('aria-label') ?? control?.textContent ?? '';
    expect(name).toContain('Minimize space');
    expect(name).not.toContain('Close');
    // Never inside the trail, where it would read as a way back.
    expect(control?.closest('nav')).toBeNull();
    cleanup();
  }
});

// regression: space-phone-bar-crowds-title
// regression: space-bar-competing-nav-controls
test('on a phone ‹ is named for where it goes, under a two-line title', () => {
  const menu = renderBar(PHONE, true);
  expect(byHandle(menu, Handles.navBack)?.getAttribute('aria-label')).toBe(
    ROOM
  );
  expect(byHandle(menu, Handles.spaceTitle)?.textContent).toBe(ROOM);
  expect(menu.textContent).toContain('Chess');
  cleanup();
  const inside = renderBar(PHONE, true, undefined, {
    place: 'Chess',
    backLabel: 'Chess',
  });
  expect(byHandle(inside, Handles.navBack)?.getAttribute('aria-label')).toBe(
    'Chess'
  );
});

// regression: space-close-label-hides-step-out
test('on a phone without Back, no leading glyph; Minimize is reachable once', () => {
  const container = renderBar(PHONE, true, () => null, {});
  expect(byHandle(container, Handles.navBack)).toBeNull();
  expect(minimizeControls(container).length).toBe(1);
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
  expect(byHandle(container, Handles.navBack)).toBeNull();
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

// regression: space-root-no-way-out — on a phone the space's list of games
// showed neither the tabs nor a way back to Spaces: only Minimize's glyph
// at the bar's far edge. At the room's root ‹ leads, named Spaces, with
// "Spaces" over the room's name, and takes the person back to Spaces.
test('phone: at the room’s root ‹ leads back to Spaces, named over the room', () => {
  const harness = createHarnessClock();
  const pressed: string[] = [];
  const nav: SpaceChromeNavProps = {
    title: ROOM,
    spaceId: 'space-1',
    place: undefined,
    onPressBack: null,
    onPressSpaces: () => pressed.push('spaces'),
  };
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider colorScheme="dark" fixedLayout={PHONE}>
        <SpaceChromeBack {...nav} />
        <SpaceChromeCompactTitle {...nav} />
      </ThemeProvider>
    </ClockProvider>
  ));
  const back = byHandle(container, Handles.spaceBackToSpaces);
  if (!(back instanceof HTMLElement)) throw new Error('no way back to Spaces');
  expect(back.getAttribute('aria-label')).toBe('Spaces');
  expect(byHandle(container, Handles.navBack)).toBeNull();
  expect(container.textContent).toContain('Spaces');
  expect(byHandle(container, Handles.spaceTitle)?.textContent).toBe(ROOM);
  fireEvent.click(back);
  expect(pressed).toEqual(['spaces']);
});
