'use strict';

/**
 * Stub `@shopify/react-native-skia` for product sims. Active-space flows mount
 * the games picker, which preloads chess assets that statically import Skia.
 * Native JSI bindings are unavailable under Jest — this mock keeps preload and
 * menu render paths from crashing the harness.
 */
const React = require('react');
const { View } = require('react-native');

function skiaComponent(displayName) {
  const Comp = ({ children, ...rest }) =>
    React.createElement(
      View,
      { ...rest, accessibilityLabel: displayName },
      children
    );
  Comp.displayName = displayName;
  return Comp;
}

const noopPath = () => ({
  moveTo: () => noopPath(),
  lineTo: () => noopPath(),
  addCircle: () => noopPath(),
  close: () => noopPath(),
  toSVGString: () => '',
});

const Skia = {
  Font: () => ({}),
  Path: { Make: noopPath },
  SVG: {
    MakeFromString: () => ({ ref: {} }),
  },
  Surface: {
    Make: () => ({
      getCanvas: () => ({
        drawSvg: () => undefined,
      }),
      makeImageSnapshot: () => ({}),
      dispose: () => undefined,
    }),
  },
  Color: () => 0,
};

module.exports = {
  Canvas: skiaComponent('SkiaCanvas'),
  Group: skiaComponent('SkiaGroup'),
  Image: skiaComponent('SkiaImage'),
  Rect: skiaComponent('SkiaRect'),
  Circle: skiaComponent('SkiaCircle'),
  Path: skiaComponent('SkiaPath'),
  Text: skiaComponent('SkiaText'),
  DashPathEffect: skiaComponent('SkiaDashPathEffect'),
  Skia,
  matchFont: () => ({}),
  FilterMode: { Nearest: 0, Linear: 1 },
  MipmapMode: { None: 0, Nearest: 1, Linear: 2 },
};
