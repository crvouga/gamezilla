/**
 * Skia Jest mock must paint Rects / Images so sim report HTML shows a board
 * instead of a black empty Canvas.
 */

import { describe, expect, it } from '@jest/globals';
import { serializeHostTreeHtml } from '@pkgs/ui-testing';
import { createElement } from 'react';
import { render } from '@testing-library/react-native';

// Mapped by jest.config moduleNameMapper → jest-skia-mock.cjs
import {
  Canvas,
  Group,
  Image,
  Rect,
  Skia,
} from '@shopify/react-native-skia';

describe('jest-skia-mock report serialization', () => {
  it('paints checkerboard Rect colors into HTML', () => {
    const light = '#f0d9b5';
    const dark = '#b58863';
    const cell = 40;
    const tree = render(
      createElement(
        Canvas,
        { style: { width: cell * 2, height: cell * 2 } },
        createElement(Rect, {
          x: 0,
          y: 0,
          width: cell,
          height: cell,
          color: light,
        }),
        createElement(Rect, {
          x: cell,
          y: 0,
          width: cell,
          height: cell,
          color: dark,
        }),
        createElement(Rect, {
          x: 0,
          y: cell,
          width: cell,
          height: cell,
          color: dark,
        }),
        createElement(Rect, {
          x: cell,
          y: cell,
          width: cell,
          height: cell,
          color: light,
        })
      )
    );
    const html = serializeHostTreeHtml(tree.toJSON());
    expect(html).toContain(`background-color:${light}`);
    expect(html).toContain(`background-color:${dark}`);
    expect(html).toContain('width:80px');
    expect(html).toContain('height:80px');
  });

  it('rasterizes SVG pieces to data-URI Images in HTML', () => {
    const svg = Skia.SVG.MakeFromString(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="6" fill="#111"/></svg>'
    );
    const surface = Skia.Surface.Make(16, 16);
    expect(surface).not.toBeNull();
    surface?.getCanvas().drawSvg(svg);
    const image = surface?.makeImageSnapshot();
    surface?.dispose();
    expect(image).toMatchObject({
      uri: expect.stringContaining('data:image/svg+xml'),
    });

    const tree = render(
      createElement(
        Canvas,
        { style: { width: 64, height: 64 } },
        createElement(
          Group,
          { transform: [{ translateX: 10 }, { translateY: 12 }] },
          createElement(Image, {
            image,
            x: 0,
            y: 0,
            width: 32,
            height: 32,
          })
        )
      )
    );
    const html = serializeHostTreeHtml(tree.toJSON());
    expect(html).toContain('<img');
    expect(html).toContain('data:image/svg+xml');
    expect(html).toContain('left:10px');
    expect(html).toContain('top:12px');
  });
});
