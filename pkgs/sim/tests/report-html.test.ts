import { describe, expect, test } from 'bun:test';
import { readUtf8 } from '@pkgs/object-store/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';

import {
  applyJunitOutcomes,
  buildHtmlReport,
  defineAction,
  defineRuntime,
  defineSnapshot,
  defineSystem,
  matchJunitCase,
  parseJunit,
  readRunBundle,
  virtualTimeRuntime,
  writeHtmlReport,
} from '../src/index';

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
        alice: `<html><head></head><body>alice sees ${s.values.x ?? ''}</body></html>`,
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
    expect(test0.blobs[html]!.text).toContain('alice sees hello');
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
    const m =
      /<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/.exec(
        html!
      );
    expect(m).not.toBeNull();
    const data = JSON.parse(m![1]!.replace(/<\\\//g, '</')) as {
      title: string;
      tests: { report: { meta: { testId: string } } }[];
    };
    expect(data.title).toBe('My run');
    expect(data.tests[0]!.report.meta.testId).toBe('kv-put');
    // Embedded frame markup must not terminate the data script early.
    expect(m![1]).not.toContain('</script>');
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
});
