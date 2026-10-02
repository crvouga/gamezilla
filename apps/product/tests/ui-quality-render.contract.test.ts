import { afterAll, expect, test } from 'bun:test';
import { snapshotFingerprint } from '@apps/product/ui-quality/fingerprint';
import { openSnapshotRenderer } from '@apps/product/ui-quality/render';
import { createUIQualityChecker } from 'ui-quality-check';

afterAll(() => Bun.WebView.closeAll());

test('concurrent reused pages preserve every frame and metadata deduplication preserves actual pixels', async () => {
  // regression: ui-quality-reused-document-evaluation — Bun evaluates expressions, so a statement sequence fails on the first reused document.
  const renderer = openSnapshotRenderer('html,body{margin:0}', undefined, 2);
  const html = (id: string, color: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><mask id="${id}"><rect width="80" height="80" fill="white"/></mask><rect mask="url(#${id})" width="80" height="80" fill="${color}"/></svg>`;
    return `<html><head></head><body><p id="title-${id}" data-testid="${id}">UI</p><img src="data:image/svg+xml;utf8,${encodeURIComponent(svg)}"></body></html>`;
  };
  try {
    const redA = html('a', 'red');
    const redB = html('b', 'red');
    expect(await snapshotFingerprint(redA, '')).toBe(
      await snapshotFingerprint(redB, '')
    );
    const frames = await Promise.all(
      [redA, html('c', 'blue'), redB, html('d', 'blue'), redA, redB].map(
        (frame) => renderer.render(frame)
      )
    );
    expect(Buffer.from(frames[0]!)).toEqual(Buffer.from(frames[2]!));
    expect(Buffer.from(frames[1]!)).toEqual(Buffer.from(frames[3]!));
    expect(Buffer.from(frames[0]!)).toEqual(Buffer.from(frames[4]!));
    expect(Buffer.from(frames[0]!)).toEqual(Buffer.from(frames[5]!));
    expect(Buffer.from(frames[0]!)).not.toEqual(Buffer.from(frames[1]!));
  } finally {
    renderer.dispose();
  }
}, 30_000);

test('the native renderer paints local styles at the recorded viewport without executing snapshot scripts', async () => {
  // regression: ui-quality-replay-viewport — Chrome clamps a requested 390px window to 500px.
  const renderer = openSnapshotRenderer(
    'html,body{margin:0;width:390px;height:844px;background:rgb(0,128,0);color:white}'
  );
  try {
    const png = await renderer.render(
      '<html><head></head><body>UI<script>document.body.remove()</script></body></html>'
    );
    const checker = await createUIQualityChecker({
      detectors: [
        {
          info: {
            id: 'pixel-contract',
            version: '1',
            executionProvider: 'in-process',
          },
          initialize: async () => {},
          dispose: async () => {},
          async score(images) {
            for (const image of images) {
              expect(image.width).toBe(390);
              expect(image.height).toBe(844);
              const corner = (843 * 390 + 389) * 3;
              expect([...image.data.slice(corner, corner + 3)]).toEqual([
                0, 128, 0,
              ]);
            }
            return images.map(() => ({ quality: 0.8 }));
          },
        },
      ],
    });
    try {
      expect((await checker.checkImage(png)).pass).toBe(true);
    } finally {
      await checker.dispose();
    }
  } finally {
    renderer.dispose();
  }
}, 30_000);

test('head styles and body attributes are refreshed when documents cannot share their context', async () => {
  const css = 'html,body{margin:0}.warning{background:red!important}';
  const reused = openSnapshotRenderer(css, undefined, 1);
  const fresh = openSnapshotRenderer(css, undefined, 1);
  const html = (color: string, bodyClass = '') =>
    `<html><head><style>body{background:${color}}</style></head><body class="${bodyClass}">UI</body></html>`;
  try {
    const green = await reused.render(html('green'));
    const blue = await reused.render(html('blue'));
    expect(Buffer.from(blue)).toEqual(
      Buffer.from(await fresh.render(html('blue')))
    );
    expect(Buffer.from(green)).not.toEqual(Buffer.from(blue));
    const warning = await reused.render(html('blue', 'warning'));
    expect(Buffer.from(warning)).not.toEqual(Buffer.from(blue));
    expect(Buffer.from(await reused.render(html('blue')))).toEqual(
      Buffer.from(blue)
    );
    expect(Buffer.from(await reused.render(html('green')))).toEqual(
      Buffer.from(green)
    );
  } finally {
    reused.dispose();
    fresh.dispose();
  }
}, 30_000);

test('unavailable external image assets fail replay rather than score a partially rendered page', async () => {
  const renderer = openSnapshotRenderer('');
  try {
    await expect(
      renderer.render(
        '<html><head></head><body>UI<img src="https://example.invalid/unavailable.png"></body></html>'
      )
    ).rejects.toThrow();
  } finally {
    renderer.dispose();
  }
}, 30_000);

test('an already cancelled replay does not launch a browser', () => {
  const controller = new AbortController();
  controller.abort(new Error('cancelled'));
  expect(() => openSnapshotRenderer('', controller.signal)).toThrow(
    'cancelled'
  );
});
