// @io-wall-ok — automated browser evidence, using the test-owned Storybook server.
import { expect, type Page, type TestInfo } from '@playwright/test';

type Reading = {
  readonly text: string;
  readonly ratio: number;
  readonly minimum: number;
  readonly foreground: string;
  readonly background: string;
};

/**
 * Measure the WCAG contrast of every visible, enabled text run on the
 * story, against the first opaque background behind it (axe leaves these
 * "incomplete" where layers overlap). `state` names the report.
 */
export async function contrast(page: Page, info: TestInfo, state: string) {
  const readings: Reading[] = await page.evaluate(() => {
    const parse = (value: string): number[] =>
      (value.match(/[\d.]+/g) ?? []).map(Number);
    const luminance = ([r = 0, g = 0, b = 0]: number[]): number => {
      const linear = (channel: number) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    };
    const background = (element: Element): number[] => {
      for (let at: Element | null = element; at; at = at.parentElement) {
        const [r = 0, g = 0, b = 0, a = 1] = parse(
          getComputedStyle(at).backgroundColor
        );
        if (a >= 0.99) return [r, g, b];
      }
      return [255, 255, 255];
    };
    const opacity = (element: Element): number => {
      let product = 1;
      for (let at: Element | null = element; at; at = at.parentElement)
        product *= Number(getComputedStyle(at).opacity);
      return product;
    };
    /** The element's own visible, enabled text, or '' to skip it. */
    const ownText = (element: Element): string => {
      const own = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim() ?? '')
        .join(' ')
        .trim();
      if (own === '' || !/[\p{L}\p{N}]/u.test(own)) return '';
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return '';
      if (getComputedStyle(element).visibility === 'hidden') return '';
      if (element.closest('.sr-only, [disabled], [aria-disabled="true"]'))
        return '';
      return own;
    };
    const measure = (element: Element, own: string): Reading => {
      const style = getComputedStyle(element);
      const [r = 0, g = 0, b = 0, a = 1] = parse(style.color);
      const back = background(element);
      const alpha = a * opacity(element);
      const fore = [r, g, b].map(
        (channel, index) => channel * alpha + (back[index] ?? 0) * (1 - alpha)
      );
      const [hi = 0, lo = 0] = [luminance(fore), luminance(back)].sort(
        (x, y) => y - x
      );
      const size = Number.parseFloat(style.fontSize);
      const large =
        size >= 24 || (Number(style.fontWeight) >= 700 && size >= 18.66);
      return {
        text: own.slice(0, 60),
        ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100,
        minimum: large ? 3 : 4.5,
        foreground: `rgb(${fore.map(Math.round).join(', ')})`,
        background: `rgb(${back.join(', ')})`,
      };
    };
    const root = document.querySelector('#storybook-root');
    if (!root) throw new Error('Missing canvas');
    const out: Reading[] = [];
    for (const element of root.querySelectorAll('*')) {
      const own = ownText(element);
      if (own !== '') out.push(measure(element, own));
    }
    return out;
  });
  await info.attach(`contrast-${state}.json`, {
    body: JSON.stringify(readings, null, 2),
    contentType: 'application/json',
  });
  const failing = readings.filter((reading) => reading.ratio < reading.minimum);
  process.stdout.write(
    `SOKOBAN_CONTRAST ${JSON.stringify({
      test: info.title,
      state,
      measured: readings.length,
      lowest: Math.min(...readings.map((reading) => reading.ratio)),
      failing,
    })}\n`
  );
  expect(failing).toEqual([]);
}
