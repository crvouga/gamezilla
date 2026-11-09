// @io-wall-ok — browser evidence adapter; the test runner owns the browser.
import type { Page } from '@playwright/test';

/** What sits on top of each text node axe could not judge, and the
 * contrast its own colours give when every layer beneath it is a flat
 * colour. A node over an image or gradient stays undetermined. */
export type ContrastFinding = {
  target: string;
  text: string;
  hitStack: string[];
  selfOnTop: boolean;
  foreground: string;
  background: string | null;
  ratio: number | null;
  required: number;
  undetermined: string | null;
};

export async function diagnoseContrast(
  page: Page,
  targets: readonly string[]
): Promise<ContrastFinding[]> {
  return await page.evaluate((selectors) => {
    type Rgba = [number, number, number, number];
    const parse = (value: string): Rgba | null => {
      const m = /rgba?\(([^)]+)\)/.exec(value);
      if (!m?.[1]) return null;
      const [r = 0, g = 0, b = 0, a = 1] = m[1]
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number);
      return [r, g, b, a];
    };
    const over = (top: Rgba, under: Rgba): Rgba => {
      const a = top[3] + under[3] * (1 - top[3]);
      if (a === 0) return [0, 0, 0, 0];
      const mix = (i: 0 | 1 | 2) =>
        (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a;
      return [mix(0), mix(1), mix(2), a];
    };
    const linear = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ([r, g, b]: Rgba) =>
      0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    const ratio = (a: Rgba, b: Rgba) => {
      const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort(
        (x, y) => y - x
      );
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };
    const describe = (el: Element) => {
      const style = getComputedStyle(el);
      const id = el.getAttribute('data-testid') ?? el.id;
      const classes = (el.getAttribute('class') ?? '')
        .split(/\s+/)
        .slice(0, 2)
        .join('.');
      return `${el.tagName.toLowerCase()}${id ? `#${id}` : ''}.${classes} pos=${style.position} z=${style.zIndex} op=${style.opacity} pe=${style.pointerEvents} bg=${style.backgroundColor}`;
    };
    const requiredRatio = (style: CSSStyleDeclaration) => {
      const size = Number.parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      return size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    };
    /** One element's own backdrop layer, or why the backdrop is unknown. */
    const layerOf = (node: Element, el: Element): Rgba | string | null => {
      const s = getComputedStyle(node);
      if (s.backgroundImage !== 'none')
        return `background image on ${describe(node)}`;
      if (node !== el && Number(s.opacity) < 1)
        return `translucent ancestor ${describe(node)}`;
      const bg = parse(s.backgroundColor);
      return bg !== null && bg[3] > 0 ? bg : null;
    };
    /** The flat colour under `el`, or why it cannot be known. */
    const backdrop = (el: Element): Rgba | string => {
      const layers: Rgba[] = [];
      for (let node: Element | null = el; node; node = node.parentElement) {
        const layer = layerOf(node, el);
        if (typeof layer === 'string') return layer;
        if (layer === null) continue;
        layers.push(layer);
        if (layer[3] === 1) break;
      }
      let fill: Rgba = [255, 255, 255, 1];
      for (const layer of layers.reverse()) fill = over(layer, fill);
      return fill;
    };
    const hits = (el: Element) => {
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = el.getBoundingClientRect();
      const stack = document.elementsFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      const top = stack[0];
      return {
        hitStack: stack.slice(0, 4).map(describe),
        selfOnTop: top !== undefined && (top === el || el.contains(top)),
      };
    };
    const finding = (target: string) => {
      const el = document.querySelector(target);
      if (!el) return { target, undetermined: 'target not found' };
      const style = getComputedStyle(el);
      const base = {
        target,
        text: el.textContent.trim().slice(0, 60),
        ...hits(el),
        foreground: style.color,
        required: requiredRatio(style),
      };
      const fill = backdrop(el);
      const fg = parse(style.color);
      if (typeof fill === 'string' || !fg)
        return {
          ...base,
          undetermined: typeof fill === 'string' ? fill : 'unparsed colour',
        };
      const rgb = fill.slice(0, 3).map(Math.round).join(', ');
      return {
        ...base,
        background: `rgb(${rgb})`,
        ratio: ratio(over(fg, fill), fill),
        undetermined: null,
      };
    };
    return selectors.slice(0, 80).map((target) => ({
      text: '',
      hitStack: [],
      selfOnTop: false,
      foreground: '',
      background: null,
      ratio: null,
      required: 4.5,
      ...finding(target),
    }));
  }, targets);
}
