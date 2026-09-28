import { describe, expect, test } from 'bun:test';
import {
  applyJunitOutcomes,
  defineAction,
  defineRuntime,
  defineSnapshot,
  defineSystem,
  matchJunitCase,
  mergeRunBundles,
  parseJunit,
  readRunBundle,
  runManifestKey,
  virtualTimeRuntime,
} from '@pkgs/harness';
import { readUtf8 } from '@pkgs/object-store/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';

import { buildHtmlReport, writeHtmlReport } from '../src/index';

type Kv = { values: Record<string, string> };

const put = defineAction({
  name: 'put',
  act: (s: Kv, key: string, value: string) => {
    s.values[key] = value;
  },
});

const sys = defineSystem({
  name: 'html-kv',
  create: (): Kv => ({ values: {} }),
  runtimes: [
    defineRuntime({
      default: true,
      name: 'virtual',
      create: () => virtualTimeRuntime(),
    }),
  ],
  actions: [put],
  snapshots: [
    defineSnapshot({ name: 'store', capture: (s: Kv) => ({ ...s.values }) }),
    defineSnapshot({
      name: 'html',
      media: 'html',
      capture: (s: Kv) => ({
        // Solid renders literal `<!---->` markers, and product markup can
        // carry a `</script>`; both must survive the inline data script.
        alice: `<html><head></head><body>alice sees <!---->${s.values['x'] ?? ''}<!----><script>x</script></body></html>`,
      }),
    }),
    defineSnapshot({
      name: 'shot',
      media: 'png',
      capture: () => new Uint8Array([137, 80, 78, 71]),
    }),
  ],
});

async function seedRun(store: ObjectStoreImplInMemory): Promise<void> {
  await using s = await sys.run({
    seed: 3,
    report: {
      store,
      runId: 'r1',
      testId: 'kv-put',
      title: 'puts a value',
      sourceFile: 'tests/kv.test.ts',
      sourceLine: 12,
      now: () => 5_000,
    },
  });
  await s.apply(put, 'x', 'hello');
}

describe('html report', () => {
  test('a test the manifest lost is still in the bundle', async () => {
    // `bun test --parallel` workers read-modify-write one manifest; the
    // report files are the record of what ran.
    const store = new ObjectStoreImplInMemory();
    await seedRun(store);
    await store.put(
      runManifestKey('r1'),
      new TextEncoder().encode(JSON.stringify({ tests: [], updatedAtMs: 0 })),
      'application/json'
    );
    const bundle = await readRunBundle(store, 'r1');
    expect(bundle.tests.map((t) => t.report.meta.testId)).toEqual(['kv-put']);
  });

  test('merged runs keep every test, prefixed by the run label', async () => {
    const a = new ObjectStoreImplInMemory();
    const b = new ObjectStoreImplInMemory();
    await seedRun(a);
    await seedRun(b);
    const merged = mergeRunBundles('all', [
      { label: 'libs/chess', bundle: await readRunBundle(a, 'r1') },
      { label: 'libs/friends', bundle: await readRunBundle(b, 'r1') },
    ]);
    expect(merged.runId).toBe('all');
    expect(merged.status).toBe('passed');
    expect(merged.tests.map((t) => t.report.meta.testId)).toEqual([
      'libs/chess/kv-put',
      'libs/friends/kv-put',
    ]);
  });

  test('bundle embeds text frames inline and binary frames as base64', async () => {
    const store = new ObjectStoreImplInMemory();
    await seedRun(store);
    const bundle = await readRunBundle(store, 'r1');
    expect(bundle.runId).toBe('r1');
    expect(bundle.status).toBe('passed');
    expect(bundle.tests).toHaveLength(1);
    const test0 = bundle.tests[0]!;
    expect(test0.report.meta.title).toBe('puts a value');
    const files = Object.keys(test0.blobs);
    expect(files.some((f) => f.endsWith('.html'))).toBe(true);
    const html = files.find((f) => f.endsWith('.html'))!;
    expect(test0.blobs[html]!.text).toContain('alice sees <!---->hello');
    const png = files.find((f) => f.endsWith('.png'))!;
    expect(test0.blobs[png]!.base64).toBe('iVBORw==');
  });

  test('writeHtmlReport emits a self-contained index.html', async () => {
    const store = new ObjectStoreImplInMemory();
    await seedRun(store);
    const out = new ObjectStoreImplInMemory();
    await writeHtmlReport({
      store,
      runId: 'r1',
      out,
      title: 'My run',
      frameCss: '.x{color:red}',
    });
    const html = await readUtf8(out, 'index.html');
    expect(html).not.toBeNull();
    expect(html).toContain('<title>My run</title>');
    expect(html).toContain('id="report-data"');
    expect(html).toContain('.x{color:red}');
    expect(html).toContain('<harness-report></harness-report>');
    expect(html).toContain('customElements');
    expect(html).toContain('sr-frame-css');
    expect(html).toContain('Keyboard shortcuts');
    expect(html).toContain('harness-report-root');
    const m =
      /<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/.exec(
        html!
      );
    expect(m).not.toBeNull();
    // The embedded data script is parsed verbatim by the browser: no
    // unescaping step, and no `<` survives to close it or open a comment.
    const data = JSON.parse(m![1]!) as {
      title: string;
      tests: {
        report: { meta: { testId: string } };
        blobs: Record<string, { text?: string }>;
      }[];
    };
    expect(data.title).toBe('My run');
    expect(data.tests[0]!.report.meta.testId).toBe('kv-put');
    expect(m![1]).not.toContain('<');
    const frame = Object.entries(data.tests[0]!.blobs).find(([f]) =>
      f.endsWith('.html')
    )!;
    expect(frame[1].text).toContain('<!---->hello<!---->');
    expect(frame[1].text).toContain('<script>x</script>');
  });

  test('junit outcomes override in-run status and titles', async () => {
    const store = new ObjectStoreImplInMemory();
    await seedRun(store);
    const xml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="tests/kv.test.ts" file="tests/kv.test.ts" tests="2">
    <testcase name="other case" file="tests/kv.test.ts" line="4" />
    <testcase name="puts a value &amp; checks" file="tests/kv.test.ts" line="10">
      <failure message="expect(received).toBe(expected)"><![CDATA[error: expected 1 to be 2]]></failure>
    </testcase>
  </testsuite>
</testsuites>`;
    const cases = parseJunit(xml);
    expect(cases).toHaveLength(2);
    expect(cases[1]!.status).toBe('failed');
    expect(cases[1]!.name).toBe('puts a value & checks');
    expect(matchJunitCase(cases, 'tests/kv.test.ts', 12)?.line).toBe(10);
    expect(matchJunitCase(cases, 'apps/x/tests/kv.test.ts', 5)?.line).toBe(4);
    const bundle = applyJunitOutcomes(await readRunBundle(store, 'r1'), cases);
    expect(bundle.status).toBe('failed');
    const meta = bundle.tests[0]!.report.meta;
    expect(meta.status).toBe('failed');
    expect(meta.title).toBe('puts a value & checks');
    expect(meta.error).toContain('expected 1 to be 2');
    const { html } = await buildHtmlReport({
      store,
      runId: 'r1',
      junitXml: xml,
    });
    expect(html).toContain('expected 1 to be 2');
  });

  test('json-only (headless) reports use the document stage', async () => {
    type State = { n: number };
    const bump = defineAction({
      name: 'bump',
      act: (s: State) => {
        s.n += 1;
      },
    });
    const headless = defineSystem({
      name: 'headless-kv',
      create: (): State => ({ n: 0 }),
      runtimes: [
        defineRuntime({
          default: true,
          name: 'virtual',
          create: () => virtualTimeRuntime(),
        }),
      ],
      actions: [bump],
      snapshots: [
        defineSnapshot({
          name: 'state',
          media: 'json',
          capture: (s: State) => ({ n: s.n }),
        }),
        defineSnapshot({
          name: 'log',
          media: 'text',
          capture: (s: State) => `n=${s.n}`,
        }),
        defineSnapshot({
          name: 'clients',
          media: 'json',
          capture: (s: State) => ({
            alice: { n: s.n },
            bob: { n: s.n * 2 },
          }),
        }),
      ],
    });
    const store = new ObjectStoreImplInMemory();
    {
      await using s = await headless.run({
        seed: 1,
        report: {
          store,
          runId: 'headless-1',
          testId: 'bump-once',
          title: 'bumps state',
          sourceFile: 'tests/headless.test.ts',
          now: () => 1_000,
        },
      });
      await s.apply(bump);
    }
    const bundle = await readRunBundle(store, 'headless-1');
    expect(bundle.tests).toHaveLength(1);
    const files = Object.keys(bundle.tests[0]!.blobs);
    expect(files.some((f) => f.includes('alice'))).toBe(true);
    expect(files.some((f) => f.includes('bob'))).toBe(true);
    const out = new ObjectStoreImplInMemory();
    await writeHtmlReport({
      store,
      runId: 'headless-1',
      out,
      title: 'Headless run',
    });
    const html = await readUtf8(out, 'index.html');
    expect(html).not.toBeNull();
    expect(html).toContain('<harness-report></harness-report>');
    expect(html).toContain('sr-stage doc');
    expect(html).toContain('sr-doc-card');
    // Blob text is JSON-escaped inside the report-data script.
    expect(html).toContain('\\"n\\":1');
    expect(html).toContain('n=1');
    expect(html).toContain('alice');
    expect(html).toContain('bob');
    expect(html).toContain('No snapshots in this frame');
  });
});
