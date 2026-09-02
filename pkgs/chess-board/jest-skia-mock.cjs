'use strict';

/**
 * Stub `@shopify/react-native-skia` for Jest / product sims.
 *
 * Native JSI bindings are unavailable under Jest. This mock keeps preload and
 * menu render paths from crashing, and emits positioned Views / Images so
 * `serializeHostTreeHtml` report frames show a checkerboard + pieces instead
 * of a black empty Canvas.
 */
const React = require('react');
const { Image: RnImage, View } = require('react-native');

function unwrapShared(value) {
  if (
    value != null &&
    typeof value === 'object' &&
    'value' in value &&
    !Array.isArray(value)
  ) {
    return value.value;
  }
  return value;
}

function num(value, fallback = 0) {
  const n = Number(unwrapShared(value));
  return Number.isFinite(n) ? n : fallback;
}

function foldTranslate(transform) {
  const list = unwrapShared(transform);
  if (!Array.isArray(list)) return { tx: 0, ty: 0 };
  let tx = 0;
  let ty = 0;
  for (const entry of list) {
    if (entry == null || typeof entry !== 'object') continue;
    if ('translateX' in entry) tx += num(entry.translateX);
    if ('translateY' in entry) ty += num(entry.translateY);
  }
  return { tx, ty };
}

function Canvas({ children, style, ...rest }) {
  const flat = Array.isArray(style) ? Object.assign({}, ...style.flat(8)) : style;
  return React.createElement(
    View,
    {
      ...rest,
      accessibilityLabel: 'SkiaCanvas',
      style: [
        {
          position: 'relative',
          overflow: 'hidden',
          width: flat?.width,
          height: flat?.height,
        },
        style,
      ],
    },
    children
  );
}
Canvas.displayName = 'SkiaCanvas';

function Group({ children, transform, opacity, style, ...rest }) {
  const { tx, ty } = foldTranslate(transform);
  const op = unwrapShared(opacity);
  return React.createElement(
    View,
    {
      ...rest,
      accessibilityLabel: 'SkiaGroup',
      style: [
        {
          position: 'absolute',
          left: tx,
          top: ty,
          ...(typeof op === 'number' ? { opacity: op } : null),
        },
        style,
      ],
    },
    children
  );
}
Group.displayName = 'SkiaGroup';

function Rect({ x, y, width, height, color, opacity, style, ...rest }) {
  const op = unwrapShared(opacity);
  return React.createElement(View, {
    ...rest,
    accessibilityLabel: 'SkiaRect',
    style: [
      {
        position: 'absolute',
        left: num(x),
        top: num(y),
        width: num(width),
        height: num(height),
        backgroundColor: typeof color === 'string' ? color : undefined,
        ...(typeof op === 'number' ? { opacity: op } : null),
      },
      style,
    ],
  });
}
Rect.displayName = 'SkiaRect';

function Circle({ cx, cy, r, color, opacity, style, ...rest }) {
  const radius = num(r);
  const op = unwrapShared(opacity);
  return React.createElement(View, {
    ...rest,
    accessibilityLabel: 'SkiaCircle',
    style: [
      {
        position: 'absolute',
        left: num(cx) - radius,
        top: num(cy) - radius,
        width: radius * 2,
        height: radius * 2,
        borderRadius: radius,
        backgroundColor: typeof color === 'string' ? color : undefined,
        ...(typeof op === 'number' ? { opacity: op } : null),
      },
      style,
    ],
  });
}
Circle.displayName = 'SkiaCircle';

function SkiaImage({ image, x, y, width, height, opacity, style, ...rest }) {
  const uri =
    image != null && typeof image === 'object' && typeof image.uri === 'string'
      ? image.uri
      : undefined;
  const op = unwrapShared(opacity);
  const boxStyle = [
    {
      position: 'absolute',
      left: num(x),
      top: num(y),
      width: num(width),
      height: num(height),
      ...(typeof op === 'number' ? { opacity: op } : null),
    },
    style,
  ];
  if (uri) {
    return React.createElement(RnImage, {
      ...rest,
      accessibilityLabel: 'SkiaImage',
      source: { uri },
      style: boxStyle,
    });
  }
  return React.createElement(View, {
    ...rest,
    accessibilityLabel: 'SkiaImage',
    style: boxStyle,
  });
}
SkiaImage.displayName = 'SkiaImage';

function SkiaPath({ children, style, ...rest }) {
  return React.createElement(
    View,
    { ...rest, accessibilityLabel: 'SkiaPath', style },
    children
  );
}
SkiaPath.displayName = 'SkiaPath';

function SkiaText({ children, style, ...rest }) {
  return React.createElement(
    View,
    { ...rest, accessibilityLabel: 'SkiaText', style },
    children
  );
}
SkiaText.displayName = 'SkiaText';

function DashPathEffect({ children, style, ...rest }) {
  return React.createElement(
    View,
    { ...rest, accessibilityLabel: 'SkiaDashPathEffect', style },
    children
  );
}
DashPathEffect.displayName = 'SkiaDashPathEffect';

const noopPath = () => ({
  moveTo: () => noopPath(),
  lineTo: () => noopPath(),
  addCircle: () => noopPath(),
  close: () => noopPath(),
  toSVGString: () => '',
});

const Skia = {
  Font: () => ({}),
  Path: {
    Make: noopPath,
    MakeFromSVGString: () => noopPath(),
  },
  SVG: {
    MakeFromString: (xml) => ({
      ref: {},
      xml: typeof xml === 'string' ? xml : '',
      dispose: () => undefined,
    }),
  },
  Surface: {
    Make: () => {
      let drawnXml = '';
      return {
        getCanvas: () => ({
          drawSvg: (svg) => {
            if (svg != null && typeof svg === 'object' && typeof svg.xml === 'string') {
              drawnXml = svg.xml;
            }
          },
        }),
        makeImageSnapshot: () => {
          if (!drawnXml) return { uri: undefined };
          const uri = `data:image/svg+xml;utf8,${encodeURIComponent(drawnXml)}`;
          return { uri };
        },
        dispose: () => undefined,
      };
    },
  },
  Color: () => 0,
};

module.exports = {
  Canvas,
  Group,
  Image: SkiaImage,
  Rect,
  Circle,
  Path: SkiaPath,
  Text: SkiaText,
  DashPathEffect,
  Skia,
  matchFont: () => ({}),
  FilterMode: { Nearest: 0, Linear: 1 },
  MipmapMode: { None: 0, Nearest: 1, Linear: 2 },
};
