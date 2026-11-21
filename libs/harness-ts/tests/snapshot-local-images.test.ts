import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  inlineLocalImageSources,
  localImageType,
} from '@libs/harness-ts/snapshot-local-images';
import { wallLocalImageDataUri } from '@libs/harness-ts/wall-local-images';

const GOOGLE_MARK = new URL(
  '../../../pkgs/ui-root-client-ts/src/brand-logos/google-g.png',
  import.meta.url
).href;

test('an in-process frame embeds a bundled image instead of naming its local file', () => {
  // regression: ui-quality-local-file-image — the account screen's Google
  // sign-in mark was recorded as a file: URL, which the sandboxed UI-quality
  // replay cannot load ("The source image cannot be decoded.").
  const frame = `<body><div class="dom-root"><img alt="" src="${GOOGLE_MARK}" draggable="false" width="20" height="20"></div></body>`;
  const html = inlineLocalImageSources(frame, wallLocalImageDataUri);
  expect(html).not.toContain('file:');
  const src = /\ssrc="([^"]*)"/.exec(html)?.[1];
  expect(src?.startsWith('data:image/png;base64,')).toBe(true);
  expect(
    Buffer.from(src!.slice('data:image/png;base64,'.length), 'base64')
  ).toEqual(
    Buffer.from(
      readFileSync(
        new URL(
          '../../../pkgs/ui-root-client-ts/src/brand-logos/google-g.png',
          import.meta.url
        )
      )
    )
  );
  expect(html).toContain('draggable="false" width="20" height="20"');
});

test('a frame naming a missing local image fails capture rather than losing the image', () => {
  const missing = new URL('./missing-mark.png', import.meta.url).href;
  expect(() =>
    inlineLocalImageSources(`<img src="${missing}">`, wallLocalImageDataUri)
  ).toThrow();
});

test('only local file sources are rewritten; web and data images are left to the replay', () => {
  const html =
    '<img src="data:image/svg+xml;utf8,%3Csvg%3E"><img src="https://example.invalid/a.png">';
  expect(
    inlineLocalImageSources(html, () => {
      throw new Error('unexpected read');
    })
  ).toBe(html);
});

test('local images are typed by extension and unknown files are refused', () => {
  expect(localImageType('file:///a/mark.SVG')).toBe('image/svg+xml');
  expect(localImageType('file:///a/photo.jpg')).toBe('image/jpeg');
  expect(() => localImageType('file:///a/sound.mp3')).toThrow(
    'no known image type'
  );
});
