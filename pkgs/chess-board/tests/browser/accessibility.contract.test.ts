import { afterAll, beforeAll, expect, test } from 'bun:test';
import { CAPTURE } from '@pkgs/chess-board/harness/positions';
import { Chess } from 'chess.js';
import { openBrowserExample } from './browser-fixture';

let browser: Awaited<ReturnType<typeof openBrowserExample>>;
beforeAll(async () => {
  browser = await openBrowserExample();
}, 60_000);
afterAll(() => browser.close());

async function act(script: string) {
  await browser.view.evaluate(
    `(() => { ${script}; return window.boardExample.paint(); })()`
  );
}
async function raster() {
  await act('document.querySelector("[data-testid=browser-board]").focus()');
  return new Bun.Image(await browser.view.screenshot())
    .png({ compressionLevel: 0 })
    .buffer();
}

test('selected, destination and check marks align with their squares at fourfold zoom', async () => {
  const checked = '4k3/8/8/8/8/8/4r3/4K3 w - - 0 1';
  for (const orientation of ['white', 'black']) {
    await act(
      `window.boardExample.reset({size:196,orientation:"${orientation}"}); window.boardExample.parent(196,4); window.boardExample.tap('e2')`
    );
    const selection = await browser.view.evaluate<{
      name: string;
      selected: string;
      destination: string;
      error: number;
      destinationError: number;
    }>(`(() => {
      const square=document.querySelector('[data-square="e2"]');
      const wash=[...document.querySelectorAll('[data-testid="browser-board-layer-squares"] div')]
        .find(el=>el.textContent==='⟦selected@e2⟧');
      const a=square.getBoundingClientRect(), b=wash.getBoundingClientRect();
      const destination=document.querySelector('[data-square="e4"]');
      const hint=[...document.querySelectorAll('[data-testid="browser-board-layer-squares"] div')]
        .find(el=>el.textContent==='⟦dot@e4⟧');
      const c=destination.getBoundingClientRect(), d=hint.getBoundingClientRect();
      return {name:square.getAttribute('aria-label'),selected:square.getAttribute('aria-pressed'),
        destination:destination.getAttribute('aria-label'),
        destinationError:Math.max(Math.abs(c.left-d.left),Math.abs(c.top-d.top),Math.abs(c.width-d.width),Math.abs(c.height-d.height)),
        error:Math.max(Math.abs(a.left-b.left),Math.abs(a.top-b.top),Math.abs(a.width-b.width),Math.abs(a.height-b.height))};
    })()`);
    expect(selection.name).toContain('White pawn');
    expect(selection.selected).toBe('true');
    expect(selection.destination).toContain('Legal destination');
    expect(selection.error).toBeLessThanOrEqual(4 / 32);
    expect(selection.destinationError).toBeLessThanOrEqual(4 / 32);
    await act(
      `window.boardExample.reset({fen:"${checked}",size:196,orientation:"${orientation}"})`
    );
    const check = await browser.view.evaluate<{
      error: number;
      color: string;
    }>(`(() => {
      const square=document.querySelector('[data-square="e1"]');
      const wash=[...document.querySelectorAll('[data-testid="browser-board-layer-squares"] div')]
        .find(el=>el.textContent==='⟦check@e1⟧');
      const a=square.getBoundingClientRect(), b=wash.getBoundingClientRect();
      return {color:getComputedStyle(wash).backgroundImage,
        error:Math.max(Math.abs(a.left-b.left),Math.abs(a.top-b.top),Math.abs(a.width-b.width),Math.abs(a.height-b.height))};
    })()`);
    expect(check.color).toContain('radial-gradient(');
    expect(check.error).toBeLessThanOrEqual(4 / 32);
  }
});

test('native promotion gives named choices focus and returns focus on cancel or choice', async () => {
  const fen = '1n5k/P7/8/8/8/8/8/6K1 w - - 0 1';
  await act(
    `window.boardExample.parent(196,1); window.boardExample.reset({fen:"${fen}",size:196}); window.boardExample.move('a7','a8')`
  );
  const request = await browser.view.evaluate<{
    names: string[];
    focused: string;
  }>(`(() => ({
    names:['q','r','b','n'].map(p=>document.querySelector('[data-testid="browser-board-promotion-'+p+'"]').getAttribute('aria-label')),
    focused:document.activeElement.getAttribute('data-testid')
  }))()`);
  expect(request.names).toEqual(['Queen', 'Rook', 'Bishop', 'Knight']);
  expect(request.focused).toBe('browser-board-promotion-q');
  await act(
    'document.activeElement.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}))'
  );
  expect(
    await browser.view.evaluate<string>(
      'document.activeElement.getAttribute("data-square")'
    )
  ).toBe('a7');
  await act(
    'window.boardExample.move("a7","a8"); document.querySelector("[data-testid=browser-board-promotion-q]").click()'
  );
  expect(
    await browser.view.evaluate<string>(
      'document.activeElement.getAttribute("data-square")'
    )
  ).toBe('a8');
});

test('a real motion-preference change ends native capture work and agrees with a fresh final raster', async () => {
  const expected = new Chess(CAPTURE);
  expected.move({ from: 'e4', to: 'd5' });
  for (const orientation of ['white', 'black']) {
    await act(
      `window.boardExample.reset({fen:${JSON.stringify(CAPTURE)},size:319.5,orientation:"${orientation}",showCoordinates:false}); window.boardExample.move('e4','d5'); window.boardExample.freeze(75)`
    );
    expect(
      await browser.view.evaluate<number>('document.getAnimations().length')
    ).toBeGreaterThan(0);
    await act('window.boardExample.reducedMotion(true)');
    expect(
      await browser.view.evaluate<number>('document.getAnimations().length')
    ).toBe(0);
    expect(
      await browser.view.evaluate<number>(
        'document.querySelector("[data-testid=browser-board]").querySelectorAll("[data-piece]:not([data-piece-square])").length'
      )
    ).toBe(0);
    const completed = await raster();
    await act(
      `window.boardExample.reset({fen:${JSON.stringify(expected.fen())},size:319.5,orientation:"${orientation}",showCoordinates:false,animations:false})`
    );
    expect((await raster()).equals(completed)).toBe(true);
  }
});
