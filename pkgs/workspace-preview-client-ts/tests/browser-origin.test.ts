import { expect, test } from 'bun:test';
import { resolveBrowserPreviewOrigin } from '@pkgs/workspace-preview-client-ts/browser-origin';

test('a provisioned development preview follows the viewing origin while production keeps its API boundary', () => {
  expect(
    resolveBrowserPreviewOrigin({
      development: true,
      enabled: true,
      origin: 'https://preview.example.test',
    })
  ).toBe('https://preview.example.test');
  expect(
    resolveBrowserPreviewOrigin({
      development: false,
      enabled: true,
      origin: 'https://preview.example.test',
    })
  ).toBeNull();
  expect(
    resolveBrowserPreviewOrigin({
      development: true,
      enabled: false,
      origin: undefined,
    })
  ).toBeNull();
  expect(() =>
    resolveBrowserPreviewOrigin({
      development: true,
      enabled: true,
      origin: undefined,
    })
  ).toThrow('browser origin');
  expect(() =>
    resolveBrowserPreviewOrigin({
      development: true,
      enabled: true,
      origin: 'file:///app',
    })
  ).toThrow('HTTP');
});
