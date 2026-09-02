/**
 * Map react-native-svg Fabric hosts (`RNSVG*`) from RNTL `toJSON()` into
 * real HTML SVG tags for simulation report snapshots.
 */

const LINECAP = ['butt', 'round', 'square'] as const;
const LINEJOIN = ['miter', 'round', 'bevel'] as const;
const UNIT_KEYWORDS = ['objectBoundingBox', 'userSpaceOnUse'] as const;

export function isRnsvgHost(typeName: string): boolean {
  return typeName.startsWith('RNSVG');
}

export function mapRnsvgTag(typeName: string): string | null {
  switch (typeName) {
    case 'RNSVGSvgView':
    case 'RNSVGSvgViewAndroid':
      return 'svg';
    case 'RNSVGGroup':
      return 'g';
    case 'RNSVGPath':
      return 'path';
    case 'RNSVGCircle':
      return 'circle';
    case 'RNSVGRect':
      return 'rect';
    case 'RNSVGLine':
      return 'line';
    case 'RNSVGEllipse':
      return 'ellipse';
    case 'RNSVGPolyline':
      return 'polyline';
    case 'RNSVGPolygon':
      return 'polygon';
    case 'RNSVGMask':
      return 'mask';
    case 'RNSVGDefs':
      return 'defs';
    case 'RNSVGLinearGradient':
      return 'linearGradient';
    case 'RNSVGRadialGradient':
      return 'radialGradient';
    case 'RNSVGStop':
      return 'stop';
    default:
      return null;
  }
}

/** Leaf SVG tags that must not emit View flex defaults or wrap children. */
export function isSvgVoidTag(tag: string): boolean {
  return (
    tag === 'path' ||
    tag === 'circle' ||
    tag === 'rect' ||
    tag === 'line' ||
    tag === 'ellipse' ||
    tag === 'polyline' ||
    tag === 'polygon'
  );
}

export function isSvgGeometryTag(tag: string): boolean {
  return (
    tag === 'svg' ||
    tag === 'g' ||
    tag === 'path' ||
    tag === 'circle' ||
    tag === 'rect' ||
    tag === 'mask' ||
    tag === 'defs' ||
    tag === 'line' ||
    tag === 'polyline' ||
    tag === 'polygon' ||
    tag === 'ellipse' ||
    tag === 'linearGradient' ||
    tag === 'radialGradient' ||
    tag === 'stop'
  );
}

/** Gradient hosts flatten stops into a `gradient` prop — synthesize `<stop>` HTML. */
export function isRnsvgGradientHost(typeName: string): boolean {
  return (
    typeName === 'RNSVGLinearGradient' || typeName === 'RNSVGRadialGradient'
  );
}

/**
 * Build `<stop …/>` markup from RNSVG's flat `[offset, argb, …]` gradient array.
 * Stops are not separate Fabric hosts (`Stop` renders null).
 */
export function serializeRnsvgGradientStops(
  gradient: unknown,
  escapeAttr: (value: string) => string
): string {
  if (!Array.isArray(gradient) || gradient.length < 2) return '';
  const parts: string[] = [];
  for (let i = 0; i + 1 < gradient.length; i += 2) {
    const offset = num(gradient[i]);
    const color = gradient[i + 1];
    if (offset === undefined || typeof color !== 'number') continue;
    parts.push(
      `<stop offset="${escapeAttr(String(offset))}" stop-color="${escapeAttr(argbToCss(color))}" />`
    );
  }
  return parts.join('');
}

/**
 * Append SVG geometry / paint attrs from RNSVG host props.
 * `escapeAttr` is injected to avoid duplicating HTML escape helpers.
 */
export function pushRnsvgAttrs(
  parts: string[],
  typeName: string,
  props: Record<string, unknown>,
  escapeAttr: (value: string) => string
): void {
  const tag = mapRnsvgTag(typeName);
  if (tag === null) return;

  if (tag === 'svg') {
    pushSvgRootAttrs(parts, props, escapeAttr);
  }
  if (tag === 'path') {
    pushAttr(parts, 'd', props['d'], escapeAttr);
  }
  if (tag === 'circle') {
    pushNumericAttr(parts, 'cx', props['cx'], escapeAttr);
    pushNumericAttr(parts, 'cy', props['cy'], escapeAttr);
    pushNumericAttr(parts, 'r', props['r'], escapeAttr);
  }
  if (tag === 'rect') {
    pushLengthAttr(parts, 'x', props['x'], escapeAttr);
    pushLengthAttr(parts, 'y', props['y'], escapeAttr);
    pushLengthAttr(parts, 'width', props['width'], escapeAttr);
    pushLengthAttr(parts, 'height', props['height'], escapeAttr);
    pushLengthAttr(parts, 'rx', props['rx'], escapeAttr);
    pushLengthAttr(parts, 'ry', props['ry'], escapeAttr);
  }
  if (tag === 'line') {
    pushNumericAttr(parts, 'x1', props['x1'], escapeAttr);
    pushNumericAttr(parts, 'y1', props['y1'], escapeAttr);
    pushNumericAttr(parts, 'x2', props['x2'], escapeAttr);
    pushNumericAttr(parts, 'y2', props['y2'], escapeAttr);
  }
  if (tag === 'ellipse') {
    pushNumericAttr(parts, 'cx', props['cx'], escapeAttr);
    pushNumericAttr(parts, 'cy', props['cy'], escapeAttr);
    pushNumericAttr(parts, 'rx', props['rx'], escapeAttr);
    pushNumericAttr(parts, 'ry', props['ry'], escapeAttr);
  }
  if (tag === 'polyline' || tag === 'polygon') {
    pushAttr(parts, 'points', props['points'], escapeAttr);
  }
  if (tag === 'mask') {
    const name = props['name'];
    if (typeof name === 'string' && name.length > 0) {
      parts.push(` id="${escapeAttr(name)}"`);
    }
    pushUnitAttr(parts, 'maskUnits', props['maskUnits'], escapeAttr);
    pushUnitAttr(
      parts,
      'maskContentUnits',
      props['maskContentUnits'],
      escapeAttr
    );
  }
  if (tag === 'linearGradient' || tag === 'radialGradient') {
    pushGradientAttrs(parts, tag, props, escapeAttr);
  }
  if (tag === 'stop') {
    pushLengthAttr(parts, 'offset', props['offset'], escapeAttr);
    const stopColor = brushToCss(props['stopColor'] ?? props['fill']);
    if (stopColor !== undefined) {
      parts.push(` stop-color="${escapeAttr(stopColor)}"`);
    }
    pushNumericAttr(parts, 'stop-opacity', props['stopOpacity'], escapeAttr);
  }

  pushMaskRef(parts, props['mask'], escapeAttr);
  pushMatrixTransform(parts, props['matrix'], escapeAttr);
  pushPaintAttrs(parts, props, escapeAttr);
}

function pushGradientAttrs(
  parts: string[],
  tag: 'linearGradient' | 'radialGradient',
  props: Record<string, unknown>,
  escapeAttr: (value: string) => string
): void {
  const name = props['name'];
  if (typeof name === 'string' && name.length > 0) {
    parts.push(` id="${escapeAttr(name)}"`);
  }
  pushUnitAttr(parts, 'gradientUnits', props['gradientUnits'], escapeAttr);
  if (tag === 'linearGradient') {
    pushLengthAttr(parts, 'x1', props['x1'], escapeAttr);
    pushLengthAttr(parts, 'y1', props['y1'], escapeAttr);
    pushLengthAttr(parts, 'x2', props['x2'], escapeAttr);
    pushLengthAttr(parts, 'y2', props['y2'], escapeAttr);
  } else {
    pushLengthAttr(parts, 'cx', props['cx'], escapeAttr);
    pushLengthAttr(parts, 'cy', props['cy'], escapeAttr);
    pushLengthAttr(parts, 'r', props['r'] ?? props['rx'], escapeAttr);
    pushLengthAttr(parts, 'fx', props['fx'], escapeAttr);
    pushLengthAttr(parts, 'fy', props['fy'], escapeAttr);
  }
  if (Array.isArray(props['gradientTransform'])) {
    const value = props['gradientTransform'];
    if (value.length >= 6) {
      const nums = value.slice(0, 6).map(String).join(' ');
      parts.push(` gradientTransform="${escapeAttr(`matrix(${nums})`)}"`);
    }
  }
}

function pushSvgRootAttrs(
  parts: string[],
  props: Record<string, unknown>,
  escapeAttr: (value: string) => string
): void {
  const minX = num(props['minX']) ?? 0;
  const minY = num(props['minY']) ?? 0;
  const vbW = num(props['vbWidth']);
  const vbH = num(props['vbHeight']);
  if (vbW != null && vbH != null) {
    parts.push(` viewBox="${escapeAttr(`${minX} ${minY} ${vbW} ${vbH}`)}"`);
  }
  const width = props['bbWidth'] ?? props['width'];
  const height = props['bbHeight'] ?? props['height'];
  pushNumericAttr(parts, 'width', width, escapeAttr);
  pushNumericAttr(parts, 'height', height, escapeAttr);
}

function pushPaintAttrs(
  parts: string[],
  props: Record<string, unknown>,
  escapeAttr: (value: string) => string
): void {
  const fill = brushToCss(props['fill']);
  if (fill !== undefined) {
    parts.push(` fill="${escapeAttr(fill)}"`);
  }
  const stroke = brushToCss(props['stroke']);
  if (stroke !== undefined) {
    parts.push(` stroke="${escapeAttr(stroke)}"`);
  }
  pushNumericAttr(parts, 'stroke-width', props['strokeWidth'], escapeAttr);
  pushNumericAttr(parts, 'opacity', props['opacity'], escapeAttr);
  pushNumericAttr(parts, 'fill-opacity', props['fillOpacity'], escapeAttr);
  pushNumericAttr(parts, 'stroke-opacity', props['strokeOpacity'], escapeAttr);
  pushStrokeDasharray(parts, props['strokeDasharray'], escapeAttr);

  const linecap = enumKeyword(props['strokeLinecap'], LINECAP);
  if (linecap) parts.push(` stroke-linecap="${linecap}"`);
  const linejoin = enumKeyword(props['strokeLinejoin'], LINEJOIN);
  if (linejoin) parts.push(` stroke-linejoin="${linejoin}"`);
}

function pushStrokeDasharray(
  parts: string[],
  value: unknown,
  escapeAttr: (value: string) => string
): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    const joined = value.map(String).join(' ');
    if (joined.length > 0) {
      parts.push(` stroke-dasharray="${escapeAttr(joined)}"`);
    }
    return;
  }
  if (typeof value === 'string' && value.length > 0) {
    parts.push(` stroke-dasharray="${escapeAttr(value)}"`);
  }
}

function pushMaskRef(
  parts: string[],
  value: unknown,
  escapeAttr: (value: string) => string
): void {
  if (typeof value !== 'string' || value.length === 0) return;
  if (value.startsWith('url(')) {
    parts.push(` mask="${escapeAttr(value)}"`);
    return;
  }
  parts.push(` mask="${escapeAttr(`url(#${value})`)}"`);
}

function pushMatrixTransform(
  parts: string[],
  value: unknown,
  escapeAttr: (value: string) => string
): void {
  if (!Array.isArray(value) || value.length < 6) return;
  const nums = value.slice(0, 6).map(String).join(' ');
  parts.push(` transform="${escapeAttr(`matrix(${nums})`)}"`);
}

function pushUnitAttr(
  parts: string[],
  name: string,
  value: unknown,
  escapeAttr: (value: string) => string
): void {
  const keyword = enumKeyword(value, UNIT_KEYWORDS);
  if (keyword) parts.push(` ${name}="${escapeAttr(keyword)}"`);
}

function brushToCss(value: unknown): string | undefined {
  if (value === null) return 'none';
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return undefined;
  const brush = value as {
    type?: unknown;
    payload?: unknown;
    brushRef?: unknown;
  };
  // extractBrush: 0=solid, 1=url(#id), 2=currentColor
  if (brush.type === 2) return 'currentColor';
  if (brush.type === 1 && typeof brush.brushRef === 'string') {
    return `url(#${brush.brushRef})`;
  }
  if (brush.type === 0 && typeof brush.payload === 'number') {
    return argbToCss(brush.payload);
  }
  return undefined;
}

/** RN `processColor` ARGB int32 → CSS hex/rgba. */
export function argbToCss(argb: number): string {
  const u = argb >>> 0;
  const a = (u >>> 24) & 0xff;
  const r = (u >>> 16) & 0xff;
  const g = (u >>> 8) & 0xff;
  const b = u & 0xff;
  if (a === 255) {
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  }
  return `rgba(${r},${g},${b},${roundAlpha(a / 255)})`;
}

function hex2(n: number): string {
  return n.toString(16).padStart(2, '0');
}

function roundAlpha(a: number): string {
  const t = Math.round(a * 1000) / 1000;
  return String(t);
}

function enumKeyword(
  value: unknown,
  table: readonly string[]
): string | undefined {
  if (typeof value === 'string' && table.includes(value)) return value;
  if (typeof value === 'number' && value >= 0 && value < table.length) {
    return table[value];
  }
  return undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.length > 0) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function pushAttr(
  parts: string[],
  name: string,
  value: unknown,
  escapeAttr: (value: string) => string
): void {
  if (typeof value === 'string' && value.length > 0) {
    parts.push(` ${name}="${escapeAttr(value)}"`);
  }
}

function pushNumericAttr(
  parts: string[],
  name: string,
  value: unknown,
  escapeAttr: (value: string) => string
): void {
  const n = num(value);
  if (n === undefined) return;
  parts.push(` ${name}="${escapeAttr(String(n))}"`);
}

/** Accepts numbers or percentage strings (`"100%"`). */
function pushLengthAttr(
  parts: string[],
  name: string,
  value: unknown,
  escapeAttr: (value: string) => string
): void {
  if (typeof value === 'string' && value.length > 0) {
    parts.push(` ${name}="${escapeAttr(value)}"`);
    return;
  }
  pushNumericAttr(parts, name, value, escapeAttr);
}
