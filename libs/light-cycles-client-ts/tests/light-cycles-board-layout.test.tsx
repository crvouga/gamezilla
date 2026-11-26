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

function mount(width: number): void {
  renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 900 }}>
      <LightCyclesBoardView
        position={POSITION}
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
test('wide: no direction pad, one line on steering by keys', () => {
  mount(1440);
  expect(screen.queryByTestId('arena-white-pad-up')).toBeNull();
  expect(
    screen.getByText(/Steer with the arrow keys or W, A, S and D/)
  ).toBeTruthy();
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
  // One row: shorter than the arrow keys' T (two 44px rows).
  expect(pad.getAttribute('data-layout')).toBe('row');
  const hint = screen.getByText(/Swipe the arena or use the pad to steer/);
  const arena = screen.getByTestId('arena-arena');
  const follows = (a: Element, b: Element): boolean =>
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  expect(follows(arena, pad)).toBe(true);
  expect(follows(pad, hint)).toBe(true);
  // Its own row across the arena's width, never sharing one with the line.
  expect(pad.contains(hint)).toBe(false);
  expect(pad.parentElement?.contains(hint)).toBe(true);
  expect(pad.textContent).not.toContain('Comet');
});

// regression: light-cycles-phone-pad-outweighs-arena — on a phone the
// three-row direction pad stood about as tall as the arena's free space
// under it, and each rider's head was a 12–16px disc whose letter could
// hardly be read. A phone draws each head 1.4 times larger.
// regression: light-cycles-phone-pad-small — the pad was then a small 44px
// T in the middle of the screen, weak for fast play. One rider steers from
// a bar of four 64px-tall buttons across the arena's width (left, up, down,
// right), one row: shorter than the T and every target wide.
test("phone: one rider steers from a full-width bar of large buttons and the riders' heads are drawn larger", () => {
  mount(390);
  const pad = screen.getByTestId('arena-white-pad');
  expect(pad.getAttribute('data-layout')).toBe('row');
  expect(pad.getAttribute('data-size')).toBe('lg');
  expect(
    [...pad.querySelectorAll('button')].map((b) =>
      b.getAttribute('data-heading')
    )
  ).toEqual(['left', 'up', 'down', 'right']);
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
  const row = css.slice(css.indexOf('.pad[data-layout="row"] {'));
  expect(row.slice(0, row.indexOf('}'))).toMatch(
    /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);[\s\S]*width:\s*100%;/
  );
  const tall = css.slice(
    css.indexOf('.pad[data-layout="row"][data-size="lg"] {')
  );
  expect(tall.slice(0, tall.indexOf('}'))).toMatch(
    /grid-template-rows:\s*var\(--ui-space-16\);/
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

// regression: light-cycles-captions-loose — on a wide screen "You ride
// Comet." floated over the arena and the keys line under it, two loose
// captions. They are one bar over the arena: the status at its start, how
// to steer at its end. A phone keeps the status above, the hint under its pad.
test('wide: the steering status and how to steer share one bar over the arena', () => {
  mount(1440);
  const header = screen.getByTestId('light-cycles-arena-header');
  expect(header.contains(screen.getByTestId('arena-status'))).toBe(true);
  expect(header.textContent).toContain('Steer with the arrow keys');
  const arena = screen.getByTestId('arena-arena');
  expect(
    header.compareDocumentPosition(arena) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  cleanup();
  mount(390);
  expect(screen.queryByTestId('light-cycles-arena-header')).toBeNull();
});
