import { describe, expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { mergeRunBundles, readRunBundle } from '@pkgs/harness';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';

import { renderHtmlReport } from '../src/index';
import { exampleApp, put } from './example-app/example-app';

const sys = exampleApp();
/** A snapshot's text as the plain encoding embeds it (`<` is `\\u003c` in the JSON script). */
const SNAPSHOT_TEXT = '\\u003c!---->hello\\u003c!---->';

async function seededBundle(testId: string) {
  const store = new ObjectStoreImplInMemory();
  await using s = await sys.run({
    seed: 3,
    report: { store, runId: 'r1', testId, title: testId, now: () => 5_000 },
  });
  await s.apply(put, 'x', 'hello');
  return readRunBundle(store, 'r1');
}

/** What a browser gives the page: the elements the bootstrap looks up. */
function fakePage(html: string) {
  const chunks = [
    ...html.matchAll(
      /<script class="report-chunk" type="text\/plain">([^<]*)<\/script>/g
    ),
  ].map((m) => ({ textContent: m[1] ?? '', remove() {} }));
  const meta =
    /<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/.exec(
      html
    );
  const mounted: { data?: unknown }[] = [];
  const document = {
    getElementById: (id: string) =>
      id === 'report-data'
        ? { textContent: meta?.[1] ?? '' }
        : { remove() {}, textContent: '' },
    querySelectorAll: () => chunks,
    createElement: () => ({}) as { data?: unknown },
    body: { append: (el: { data?: unknown }) => mounted.push(el) },
  };
  const bootstrap =
    /<script>(\n\(async \(\) => \{\n {2}const status[\s\S]*?)<\/script>/.exec(
      html
    );
  return { document, mounted, bootstrap: bootstrap?.[1] ?? '' };
}

describe('pooled report', () => {
  test('keeps each distinct snapshot once and the bootstrap restores the data exactly', async () => {
    const a = await seededBundle('one');
    const b = await seededBundle('two');
    const runs = Array.from({ length: 20 }, (_, i) => ({
      label: `run${String(i)}`,
      bundle: i % 2 === 0 ? a : b,
    }));
    const bundle = mergeRunBundles('all', runs);
    const plain = renderHtmlReport(bundle, { title: 'T' });
    const pooled = renderHtmlReport(bundle, { title: 'T', pooled: true });

    // Twenty tests, two distinct sets of snapshots: the pool holds each once.
    expect(pooled.length).toBeLessThan(plain.length);
    expect(pooled).toContain('<title>T</title>');
    expect(pooled).not.toContain('<harness-report></harness-report>');
    expect(pooled).not.toContain(SNAPSHOT_TEXT);

    const page = fakePage(pooled);
    expect(page.bootstrap).not.toBe('');
    await runInNewContext(page.bootstrap, {
      document: page.document,
      atob,
      Blob,
      Response,
      DecompressionStream,
      Uint8Array,
      JSON,
      Object,
      String,
    });
    expect(page.mounted).toHaveLength(1);
    expect(page.mounted[0]?.data).toEqual({ ...bundle, title: 'T' });
  });

  test('the default stays plain JSON with the element in the markup', async () => {
    const bundle = await seededBundle('one');
    const html = renderHtmlReport(bundle, { title: 'T' });
    expect(html).toContain('<harness-report></harness-report>');
    expect(html).toContain(SNAPSHOT_TEXT);
    expect(html).not.toContain('report-chunk');
  });
});
