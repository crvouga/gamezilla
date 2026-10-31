import { afterAll, beforeAll, expect, test } from 'bun:test';
import { CAPTURE } from '@pkgs/chess-board-root-harness-ts/positions';
import { openBrowserExample } from './browser-fixture';

let browser: Awaited<ReturnType<typeof openBrowserExample>>;
beforeAll(async () => {
  browser = await openBrowserExample();
}, 60_000);
afterAll(() => browser.close());

async function prepare(
  width: number,
  scale: number,
  orientation: string,
  capture: boolean
) {
  await browser.view.evaluate(`(async () => {
    const api=window.boardExample;
    api.reset({size:${width},orientation:"${orientation}",showCoordinates:true${capture ? `,fen:${JSON.stringify(CAPTURE)}` : ''}});
    api.parent(${width},${scale});
    await api.paint();
    ${capture ? "api.tap('e4'); await api.paint();" : ''}
  })()`);
}

test('occupied capture rings share the real target cell after fractional sizing and zoom', async () => {
  for (const width of [196, 319.5, 640])
    for (const scale of [0.5, 1, 4]) {
      for (const orientation of ['white', 'black']) {
        await prepare(width, scale, orientation, true);
        const actual = await browser.view.evaluate<{
          error: number;
          image: string;
          name: string;
        }>(`(() => {
        const board=document.querySelector('[data-testid="browser-board"]');
        const square=board.querySelector('[data-square="d5"]');
        const ring=[...board.querySelectorAll('[data-testid="browser-board-layer-squares"] div')]
          .find(el=>el.textContent==='⟦ring@d5⟧');
        const a=square.getBoundingClientRect(),b=ring.getBoundingClientRect();
        return {name:square.getAttribute('aria-label'),image:getComputedStyle(ring).backgroundImage,
          error:Math.max(Math.abs(a.left-b.left),Math.abs(a.top-b.top),Math.abs(a.width-b.width),Math.abs(a.height-b.height))};
      })()`);
        expect(actual.name).toContain('Black pawn');
        expect(actual.name).toContain('Legal destination');
        expect(actual.image).toContain('radial-gradient(');
        expect(actual.error).toBeLessThanOrEqual(scale / 32);
        await browser.view.evaluate(
          'window.boardExample.configure({highlightLegalMoves:false})'
        );
        expect(
          await browser.view.evaluate<number>(
            `[...document.querySelectorAll('[data-testid="browser-board-layer-squares"] div')].filter(el=>el.textContent==='⟦ring@d5⟧').length`
          )
        ).toBe(0);
      }
    }
});

type Label = { name: string; error: number; inset: number; edgeHalf: boolean };
test('every file and rank label occupies its correct viewer-edge cell in either orientation', async () => {
  // regression: chessboard-coordinate-label-descent — Linux, White, 196px, half scale, file g.
  // regression: chessboard-file-label-overhang — Linux CI image, Black, 196px, half scale, file f.
  for (const width of [196, 319.5, 640])
    for (const scale of [0.5, 1, 4]) {
      for (const orientation of ['white', 'black']) {
        await prepare(width, scale, orientation, false);
        const labels = await browser.view.evaluate<Label[]>(`(() => {
        const board=document.querySelector('[data-testid="browser-board"]');
        return [...board.querySelectorAll('svg text')].map(label=>{
          const name=label.textContent;
          const file=/^[a-h]$/.test(name);
          const square=file ? name+'${orientation === 'white' ? '1' : '8'}' : '${orientation === 'white' ? 'a' : 'h'}'+name;
          const cell=board.querySelector('[data-square="'+square+'"]');
          const a=cell.getBoundingClientRect(),b=label.getBoundingClientRect();
          const centerX=b.left+b.width/2,centerY=b.top+b.height/2;
          return {name,error:Math.max(a.left-b.left,a.top-b.top,b.right-a.right,b.bottom-a.bottom,0),
            inset:Math.min(b.left-a.left,b.top-a.top,a.right-b.right,a.bottom-b.bottom),
            edgeHalf:file ? centerX>a.left+a.width/2&&centerY>a.top+a.height/2 : centerX<a.left+a.width/2&&centerY<a.top+a.height/2};
        });
      })()`);
        expect(labels.map((label) => label.name).toSorted()).toEqual([
          '1',
          '2',
          '3',
          '4',
          '5',
          '6',
          '7',
          '8',
          'a',
          'b',
          'c',
          'd',
          'e',
          'f',
          'g',
          'h',
        ]);
        for (const label of labels) {
          expect(
            label.error,
            JSON.stringify({ orientation, width, scale, label })
          ).toBeLessThanOrEqual(scale / 32);
          expect(label.inset).toBeGreaterThanOrEqual(-scale / 32);
          expect(label.edgeHalf).toBe(true);
        }
        await browser.view.evaluate(
          'window.boardExample.configure({showCoordinates:false})'
        );
        expect(
          await browser.view.evaluate<number>(
            'document.querySelectorAll("[data-testid=browser-board] svg text").length'
          )
        ).toBe(0);
      }
    }
});
