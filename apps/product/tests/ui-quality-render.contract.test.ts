import { afterAll, expect, test } from 'bun:test';
import { openSnapshotRenderer } from '@apps/product/ui-quality/render';
import { createUIQualityChecker } from 'ui-quality-check';

afterAll(() => Bun.WebView.closeAll());

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
