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

/** Every piece kind on every edge square that carries a label, either way up. */
const EDGE_ZOO = 'QBNRqbnr/K6k/B6b/N6n/R6r/Q6q/P6p/qbnrQBNK w - - 0 1';

type Overlap = { label: string; square: string; piece: string; ink: number };
/**
 * Paints each label's glyph and the figure of the piece on its square into
 * one canvas, at the sizes the browser computed, and counts the pixels both
 * cover. No production geometry helper participates.
 */
const LABEL_PIECE_OVERLAP = `(async () => {
  const board=document.querySelector('[data-testid="browser-board"]');
  const R=4, out=[];
  for (const label of board.querySelectorAll('svg text')) {
    const cell=[...board.querySelectorAll('[data-square]')].find(el=>{
      const a=el.getBoundingClientRect(),b=label.getBoundingClientRect();
      const x=b.left+b.width/2,y=b.top+b.height/2;
      return x>=a.left&&x<a.right&&y>=a.top&&y<a.bottom;
    });
    const square=cell.dataset.square;
    const piece=board.querySelector('[data-piece-square="'+square+'"]');
    if (piece===null) continue;
    const style=getComputedStyle(piece), text=getComputedStyle(label);
    const img=new Image(); img.src=style.backgroundImage.slice(5,-2); await img.decode();
    const p=piece.getBoundingClientRect(), side=p.width*R;
    const fill=parseFloat(style.backgroundSize)/100;
    const paint=(draw)=>{const c=new OffscreenCanvas(Math.ceil(side),Math.ceil(side));
      const g=c.getContext('2d'); draw(g); return g.getImageData(0,0,c.width,c.height).data;};
    const figure=paint(g=>g.drawImage(img,(side-side*fill)/2,(side-side*fill)/2,side*fill,side*fill));
    const svg=label.ownerSVGElement, unit=svg.getBoundingClientRect().width/svg.viewBox.baseVal.width;
    const s=svg.getBoundingClientRect();
    const glyph=paint(g=>{
      g.font=text.fontWeight+' '+(Number(label.getAttribute('font-size'))*unit*R)+'px '+text.fontFamily;
      g.textAlign=label.getAttribute('text-anchor')==='end'?'right':'left';
      g.fillText(label.textContent,(s.left+Number(label.getAttribute('x'))*unit-p.left)*R,(s.top+Number(label.getAttribute('y'))*unit-p.top)*R);
    });
    let ink=0;
    for (let i=3;i<figure.length;i+=4) if (figure[i]>32&&glyph[i]>32) ink++;
    out.push({label:label.textContent,square,piece:piece.dataset.piece,ink});
  }
  return out;
})()`;

// regression: chessboard-webkit-knight-label-collision
test('no coordinate label touches the figure of the piece on its square', async () => {
  // regression: chessboard-coordinate-piece-collision — White, 536px desktop board: h1's rook and c1–e1's bishop, queen and king met their labels.
  for (const width of [358, 536, 640])
    for (const orientation of ['white', 'black'])
      for (const fen of [
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        EDGE_ZOO,
      ]) {
        await browser.view.evaluate(`(async () => {
          const api=window.boardExample;
          api.reset({size:${width},orientation:"${orientation}",showCoordinates:true,fen:${JSON.stringify(fen)}});
          api.parent(${width},1);
          await api.paint();
        })()`);
        const overlaps =
          await browser.view.evaluate<Overlap[]>(LABEL_PIECE_OVERLAP);
        expect(overlaps.length).toBeGreaterThanOrEqual(12);
        for (const overlap of overlaps)
          expect(
            overlap.ink,
            JSON.stringify({ width, orientation, overlap })
          ).toBe(0);
      }
});

type LabelInk = { px: number; ink: string; fill: string; square: string };
/** Each label's drawn size in px, its ink and the colour of the square under it. */
const LABEL_INKS = `(() => {
  const board=document.querySelector('[data-testid="browser-board"]');
  const vars=getComputedStyle(board);
  return [...board.querySelectorAll('svg text')].map(label=>{
    const svg=label.ownerSVGElement, unit=svg.getBoundingClientRect().width/svg.viewBox.baseVal.width;
    const ink=label.dataset.ink;
    return {px:Number(label.getAttribute('font-size'))*unit, ink, fill:getComputedStyle(label).fill,
      square:vars.getPropertyValue(ink==='on-light'?'--chess-sq-light':'--chess-sq-dark').trim()};
  });
})()`;

/** WCAG relative luminance of `rgb(…)` or `#rrggbb`. */
function luminance(color: string): number {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  const parts = hex
    ? [0, 2, 4].map((at) => Number.parseInt(hex.slice(at, at + 2), 16))
    : (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const [r = 0, g = 0, b = 0] = parts.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

// regression: chessboard-coordinates-illegible — 17-unit labels at 80% opacity read at ~7.6px on a 358px phone board, in an ink barely off the square's.
test('coordinate labels read at about 11px on a desktop board, larger on a phone one, in an ink that contrasts with their square', async () => {
  const sizes: Record<number, number> = {};
  for (const width of [358, 536, 640]) {
    await prepare(width, 1, 'white', false);
    const labels = await browser.view.evaluate<LabelInk[]>(LABEL_INKS);
    expect(labels).toHaveLength(16);
    sizes[width] = labels[0]?.px ?? 0;
    for (const label of labels)
      expect(
        contrast(label.fill, label.square),
        JSON.stringify({ width, label })
      ).toBeGreaterThanOrEqual(label.ink === 'on-light' ? 4.5 : 2.6);
  }
  expect(sizes[536]).toBeGreaterThanOrEqual(10.5);
  expect(sizes[536]).toBeLessThanOrEqual(11.5);
  expect(sizes[640]).toBeGreaterThanOrEqual(10.5);
  // A phone board's labels take the most its corners hold: well past the
  // 7.6px a fixed sixth of a square gave.
  expect(sizes[358]).toBeGreaterThanOrEqual(8.8);
});
