import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { collectArtifacts } from '../scripts/collect';
import { createSnapshotFingerprint } from '../scripts/fingerprint';
import preparationFrame from './fixtures/ui-quality-preparation-frame.json';

const snapshotFingerprint = createSnapshotFingerprint('');

// regression: ui-quality-ci-snapshot-volume — this literal frame came from the preparation that exceeded 600 seconds.
test('reusing the stylesheet preserves the original captured-frame fingerprint', async () => {
  const fingerprint = createSnapshotFingerprint(preparationFrame.stylesheet);
  for (let frame = 0; frame < 2; frame++) {
    const value = await fingerprint(preparationFrame.html);
    expect(createHash('sha256').update(value).digest('hex')).toBe(
      preparationFrame.fingerprintSha256
    );
  }
});

// regression: ui-quality-ci-snapshot-volume — 101,035 references / 30,355 raw documents exceeded CI's deadline.
test('metadata-only variations collapse without discarding origins or visible content', async () => {
  const source = new ObjectStoreImplInMemory();
  const output = new ObjectStoreImplInMemory();
  await writeUtf8(source, 'complete.json', '{"status":0}');
  await writeUtf8(
    source,
    'a.html',
    '<html><head></head><body><p id="title-cl-1" data-testid="a">A dialog</p></body></html>'
  );
  await writeUtf8(
    source,
    'b.html',
    '<html><head></head><body><p id="title-cl-2" data-testid="b">A dialog</p></body></html>'
  );
  const manifest = await collectArtifacts(
    [{ package: '@apps/example', bucket: 'part-0', store: source }],
    output,
    (html) => snapshotFingerprint(html)
  );
  expect(manifest.references).toBe(2);
  expect(manifest.artifacts).toHaveLength(1);
  expect(manifest.artifacts[0]!.origins).toHaveLength(2);
});

test('every visible text, spacing and class change retains a distinct input', async () => {
  await assertProperty(
    'visible content survives fingerprinting',
    fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), async (n) => {
      const html =
        '<html><head></head><body><p class="title" style="width:120px">Text</p></body></html>';
      const baseline = await snapshotFingerprint(html);
      for (const changed of [
        html.replace('Text', `Text ${'W'.repeat(n)}`),
        html.replace('120px', `${120 + n}px`),
        html.replace('class="title"', `class="title broken-${n}"`),
      ])
        expect(await snapshotFingerprint(changed)).not.toBe(baseline);
    })
  );
});

test('CSS attributes, IDs, fragment references and form labels keep their identifiers', async () => {
  const html =
    '<html><head><style>[data-actor="alice"]{color:red}</style></head><body><p id="title" data-testid="a" data-actor="alice">UI</p><label for="field">Name</label><input id="field"><svg><mask id="mask"></mask><path mask="url(#mask)"></path></svg></body></html>';
  const key = await createSnapshotFingerprint(
    '#title{color:blue}[data-testid="a"]{margin:9px}'
  )(html);
  for (const attribute of [
    'id="title"',
    'data-testid="a"',
    'data-actor="alice"',
    'id="field"',
    'id="mask"',
  ])
    expect(key).toContain(attribute);
});

test('SVG mask references are renamed together, and malformed references stay distinct', async () => {
  const svg = (id: string, ref = id) =>
    `<svg xmlns="http://www.w3.org/2000/svg"><mask id="${id}"><rect width="10" height="10" fill="white"/></mask><rect mask="url(#${ref})" width="10" height="10" fill="red"/></svg>`;
  const html = (s: string) =>
    `<html><head></head><body>UI<img src="data:image/svg+xml;utf8,${encodeURIComponent(s)}"></body></html>`;
  expect(await snapshotFingerprint(html(svg('random-a')))).toBe(
    await snapshotFingerprint(html(svg('random-b')))
  );
  expect(await snapshotFingerprint(html(svg('random-a', 'uq-0')))).not.toBe(
    await snapshotFingerprint(html(svg('random-b')))
  );
  expect(
    await snapshotFingerprint(
      html(svg('random-a').replace('fill="red"', 'fill="blue"'))
    )
  ).not.toBe(await snapshotFingerprint(html(svg('random-b'))));
});
