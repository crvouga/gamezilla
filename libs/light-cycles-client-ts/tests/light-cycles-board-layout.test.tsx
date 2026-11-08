/** Light Cycles' arena on a wide screen and a phone: how to steer, and the scores once. */

import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LightCyclesBoardView } from '@libs/light-cycles-client-ts/light-cycles-board-view';
import { lightCyclesConfig } from '@libs/light-cycles-shared-ts/light-cycles-config';
import { lightCyclesPositionCodec } from '@libs/light-cycles-shared-ts/light-cycles-position';
import { initialLightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { GameSeatSwatch } from '@pkgs/ui-root-client-ts/game-seat-swatch';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const POSITION = lightCyclesPositionCodec(3).encode(
  initialLightCyclesState(lightCyclesConfig(), ['white', 'black', 'red'])
);

function mount(width: number, position = POSITION): void {
  renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 900 }}>
      <LightCyclesBoardView
        position={position}
        orientation="white"
        interactive={false}
        sound={false}
        syncKey={0}
        testId="arena"
        setup={null}
        hand={null}
        committed={[]}
        commitment={null}
        onAction={() => undefined}
        simulation={{
          paused: false,
          stale: false,
          sides: ['white'],
          onInput: () => undefined,
          onRelease: () => undefined,
        }}
      />
    </ThemeProvider>
  ));
}

// regression: light-cycles-pad-on-desktop — a wide screen drew the phone's
// direction pad under a long paragraph, running off the window's foot.
// regression: light-cycles-desktop-input-undiscoverable
test('wide: no direction pad, one line on steering by keys', () => {
  mount(1440);
  expect(screen.queryByTestId('arena-white-pad-up')).toBeNull();
  expect(
    screen.getByText(/Click the arena or Tab to it, then steer with arrow keys/)
  ).toBeTruthy();
  expect(screen.getByText(/You can also drag to steer/)).toBeTruthy();
});

test('phone: the direction pad is under the arena, with a line on swiping', () => {
  mount(390);
  expect(screen.getByTestId('arena-white-pad-up')).toBeTruthy();
  expect(screen.getByText(/Swipe the arena or use the pad/)).toBeTruthy();
});

// regression: light-cycles-scores-twice — every rider's round wins showed
// over the arena as well as on each player's strip.
test('the scores and the round are said to a listener, not drawn over the arena again', () => {
  mount(1440);
  for (const id of ['arena-score-white', 'arena-round']) {
    const hidden = screen
      .getByTestId(id)
      .closest('[data-component="VisuallyHidden"]');
    expect(hidden).not.toBeNull();
  }
});

// regression: light-cycles-pad-off-screen — on a phone the 64px direction
// pad (about 230px with its rider's name over it) ran past the bottom of
// the screen under the arena. One rider's pad is a compact thumb pad, its
// rider already named above the arena.
// regression: light-cycles-pad-beside-hint — that pad then sat beside the
// steering line, off to one side of the arena. It now sits right under the
// arena, centred where the thumb is, and how to steer follows it.
test('phone: one rider steers from a compact pad right under the arena', () => {
  mount(390);
  const pad = screen.getByTestId('arena-white-pad');
  expect(pad.getAttribute('data-size')).toBe('sm');
  const hint = screen.getByText(/Swipe the arena or use the pad to steer/);
  const arena = screen.getByTestId('arena-arena');
  const follows = (a: Element, b: Element): boolean =>
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  expect(follows(arena, pad)).toBe(true);
  expect(follows(pad, hint)).toBe(true);
  // Its own centred row, never sharing one with the line.
  const row = pad.closest('[data-component="StackHorizontal"]');
  expect(row?.contains(hint)).toBe(false);
  expect(row?.className).toContain('justify-center');
  expect(pad.parentElement?.textContent).not.toContain('Comet');
});

// regression: light-cycles-phone-pad-outweighs-arena — on a phone the
// three-row direction pad stood about as tall as the arena's free space
// under it, and each rider's head was a 12–16px disc whose letter could
// hardly be read. The pad is the arrow keys' T, a row shorter, every
// button still 44px; a phone draws each head 1.4 times larger.
test("phone: the pad is the arrow keys' T and the riders' heads are drawn larger", () => {
  mount(390);
  const pad = screen.getByTestId('arena-white-pad');
  expect(pad.getAttribute('data-layout')).toBe('arrows');
  expect(pad.getAttribute('data-size')).toBe('sm');
  expect(
    [...pad.querySelectorAll('button')].map((b) =>
      b.getAttribute('data-heading')
    )
  ).toEqual(['up', 'left', 'down', 'right']);
  for (const rider of [0, 1, 2])
    expect(
      screen.getByTestId(`arena-arena-rider-${rider}`).getAttribute('transform')
    ).toContain('scale(1.4)');
  cleanup();
  mount(1440);
  expect(
    screen.getByTestId('arena-arena-rider-0').getAttribute('transform')
  ).toContain('scale(1)');
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../../pkgs/ui-root-client-ts/src/direction-pad/direction-pad.module.css'
    ),
    'utf8'
  );
  const arrows = css.slice(css.indexOf('.pad[data-layout="arrows"] {'));
  expect(arrows.slice(0, arrows.indexOf('}'))).toMatch(
    /grid-template-areas:\s*". up ."\s*"left down right";/
  );
});

// regression: light-cycles-arena-double-frame — the arena's walls sat
// inside a dark rounded card a cell and a half wider on every side, so the
// arena read as letterboxed in a second frame. The card is gone: the ground
// is drawn inside the walls, the walls are the one frame, and the room
// around them for a head at the edge hangs outside the arena's box.
test('the arena has one frame: its walls, flush with the column', () => {
  mount(1440);
  const arena = screen.getByTestId('arena-arena');
  const drawing = screen.getByTestId('arena-arena-drawing');
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../../pkgs/ui-root-client-ts/src/trail-arena/trail-arena.module.css'
    ),
    'utf8'
  );
  const rule = (selector: string): string => {
    const open = css.indexOf('{', css.indexOf(`${selector} {`));
    return css.slice(open + 1, css.indexOf('}', open));
  };
  expect(css).toMatch(/\.arena \{[^}]*background:\s*none;/);
  expect(rule('.ground')).toMatch(/fill:\s*var\(--ui-color-background\);/);
  expect(drawing.style.width).not.toBe('100%');
  expect(drawing.style.margin.startsWith('-')).toBe(true);
  expect(arena.contains(drawing)).toBe(true);
});

// regression: light-cycles-marker-unmatched — a trail paint's swatch is
// drawn in the very token its rider's trail is drawn in.
test("a trail paint's swatch matches its rider's trail token", () => {
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../../pkgs/ui-root-client-ts/src/trail-arena/trail-arena.module.css'
    ),
    'utf8'
  );
  const paints = ['trail-one', 'trail-two', 'trail-three', 'trail-four'];
  renderWithI18n(() => (
    <>
      {paints.map((paint) => (
        <GameSeatSwatch
          look={{ color: paint as 'trail-one', mark: 'C' }}
          dataSet={{ testid: paint }}
        />
      ))}
    </>
  ));
  paints.forEach((paint, rider) => {
    const token = new RegExp(
      `\\.arena \\[data-rider="${rider}"\\] \\{\\s*--rider-color: var\\(--ui-color-game-light-cycles-([a-z]+)\\);`
    ).exec(css)?.[1];
    expect(token).toBeDefined();
    expect(screen.getByTestId(paint).className).toContain(
      `bg-game-light-cycles-${token ?? ''}`
    );
  });
});

// regression: light-cycles-unreadable-no-recovery
test('the literal unreadable trio position offers existing app version recovery', () => {
  mount(390, 'light-cycles-3:not-a-position');
  expect(
    screen.getByRole('link', { name: 'Check app version' }).getAttribute('href')
  ).toBe('/more/about');
  expect(screen.getByRole('alert').textContent).toContain(
    'then reopen this game'
  );
  expect(screen.queryByRole('application')).toBeNull();
});
