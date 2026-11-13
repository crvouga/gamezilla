import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { type BuildStamp, stampedPage } from '../src/build-stamp';

const PAGE =
  '<!doctype html><html><head><title>t</title></head><body><div id="root"></div><script type="module" src="/assets/index.js"></script></body></html>';

const stamp = fc.record({ commit: fc.string(), date: fc.string() });

/** What the page's script assigns: JSON is a JavaScript literal. */
function read(html: string): BuildStamp {
  const script = /<script data-build>([^<]*)<\/script>/.exec(html)?.[1] ?? '';
  const assigned = 'globalThis.__BUILD__=';
  expect(script).toStartWith(assigned);
  return JSON.parse(script.slice(assigned.length)) as BuildStamp;
}

test('a stamped page runs its build before anything else in it, and is otherwise the page', () => {
  const build = { commit: 'a'.repeat(40), date: '2026-11-13T12:00:00-06:00' };
  const html = stampedPage(PAGE, build);
  expect(html).toStartWith('<!doctype html><html><head><script data-build>');
  expect(read(html)).toEqual(build);
  expect(html.replace(/<script data-build>[^<]*<\/script>/, '')).toBe(PAGE);
});

test('whatever a commit and date spell, the page reads them back and the script stays closed', () => {
  assertProperty(
    'the stamp round-trips',
    fc.property(stamp, (build) => {
      const html = stampedPage(PAGE, build);
      expect(read(html)).toEqual(build);
      expect(html.match(/<script data-build>/g)?.length).toBe(1);
    })
  );
});

test('stamping again replaces the stamp: one page per deploy, never two builds', () => {
  assertProperty(
    'the last stamp wins',
    fc.property(stamp, stamp, (first, second) => {
      expect(stampedPage(stampedPage(PAGE, first), second)).toBe(
        stampedPage(PAGE, second)
      );
    })
  );
});

test('a page with no head is refused', () => {
  expect(() =>
    stampedPage('<p>no head</p>', { commit: 'a', date: 'b' })
  ).toThrow('no <head>');
});
