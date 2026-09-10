/**
 * Fixture sources for every edge-case catalog id.
 * Smoke only: transform (or map) must not throw; contracts are light.
 */

import type { CatalogFamily } from './edge-case-catalog';

export type FixtureKind = 'transform' | 'map' | 'gate';

export type CatalogFixture = {
  readonly id: string;
  readonly family: CatalogFamily;
  readonly kind: FixtureKind;
  /** TSX/TS source for transform fixtures. */
  readonly source?: string;
  /** Record for mapSxRecord fixtures. */
  readonly record?: Record<string, unknown>;
  /** Expect convert to drop purged tag (when true). */
  readonly expectConverted?: boolean;
  /** Expect parseError. */
  readonly expectParseError?: boolean;
};

const BOX = `import { Box } from '@pkgs/ui';\n`;
const CLICK = `import { Clickable } from '@pkgs/ui';\n`;
const TEXT = `import { Text } from '@pkgs/ui';\n`;
const STACK = `import { Stack } from '@pkgs/ui';\n`;
const CENTER = `import { Center } from '@pkgs/ui';\n`;
const SPACER = `import { Spacer } from '@pkgs/ui';\n`;
const CARD = `import { Card } from '@pkgs/ui';\n`;
const DIV = `import { Divider } from '@pkgs/ui';\n`;
const SCROLL = `import { ScrollView } from '@pkgs/ui';\n`;

function t(
  id: string,
  family: CatalogFamily,
  source: string,
  opts?: { expectConverted?: boolean; expectParseError?: boolean }
): CatalogFixture {
  return { id, family, kind: 'transform', source, ...opts };
}

function m(id: string, record: Record<string, unknown>): CatalogFixture {
  return { id, family: 'C', kind: 'map', record };
}

function boxSx(id: string, sxExpr: string, converted = true): CatalogFixture {
  return t(
    id,
    'B',
    `${BOX}export const A = (p: { x: number; c: boolean; d: 'flex'; h: () => number; sx: never; rest: never }) => <Box sx={${sxExpr}} />;`,
    { expectConverted: converted }
  );
}

/** Every catalog id must appear exactly once. */
export const CATALOG_FIXTURES: readonly CatalogFixture[] = [
  // A
  t(
    'A.static-sx',
    'A',
    `${BOX}export const A = () => <Box sx={{ p: 4, background: 'surface' }}>x</Box>;`,
    { expectConverted: true }
  ),
  t('A.no-sx-box', 'A', `${BOX}export const A = () => <Box id="a" />;`, {
    expectConverted: true,
  }),
  t(
    'A.as-span',
    'A',
    `${BOX}export const A = () => <Box as="span" sx={{ m: 1 }}>x</Box>;`,
    { expectConverted: true }
  ),
  t(
    'A.as-nav',
    'A',
    `${BOX}export const A = () => <Box as="nav" sx={{ m: 1 }}>x</Box>;`,
    { expectConverted: true }
  ),
  t(
    'A.as-h1',
    'A',
    `${BOX}export const A = () => <Box as="h1" sx={{ m: 1 }}>x</Box>;`,
    { expectConverted: true }
  ),
  t(
    'A.as-section',
    'A',
    `${BOX}export const A = () => <Box as="section" sx={{ m: 1 }}>x</Box>;`,
    { expectConverted: true }
  ),
  t(
    'A.as-li',
    'A',
    `${BOX}export const A = () => <Box as="li" sx={{ m: 1 }}>x</Box>;`,
    { expectConverted: true }
  ),
  t(
    'A.as-header',
    'A',
    `${BOX}export const A = () => <Box as="header" sx={{ m: 1 }}>x</Box>;`,
    { expectConverted: true }
  ),
  t(
    'A.as-ul',
    'A',
    `${BOX}export const A = () => <Box as="ul" sx={{ m: 1 }}>x</Box>;`,
    { expectConverted: true }
  ),
  t(
    'A.as-main',
    'A',
    `${BOX}export const A = () => <Box as="main" sx={{ m: 1 }}>x</Box>;`,
    { expectConverted: true }
  ),
  t(
    'A.as-h3',
    'A',
    `${BOX}export const A = () => <Box as="h3" sx={{ m: 1 }}>x</Box>;`,
    { expectConverted: true }
  ),
  t(
    'A.as-time',
    'A',
    `${BOX}export const A = () => <Box as="time" sx={{ m: 1 }}>x</Box>;`,
    { expectConverted: true }
  ),
  t(
    'A.as-p',
    'A',
    `${BOX}export const A = () => <Box as="p" sx={{ m: 1 }}>x</Box>;`,
    { expectConverted: true }
  ),
  t(
    'A.as-label',
    'A',
    `${BOX}export const A = () => <Box as="label" sx={{ m: 1 }}>x</Box>;`,
    { expectConverted: true }
  ),
  t(
    'A.as-h2',
    'A',
    `${BOX}export const A = () => <Box as="h2" sx={{ m: 1 }}>x</Box>;`,
    { expectConverted: true }
  ),
  t(
    'A.as-non-intrinsic',
    'A',
    `${BOX}export const A = () => <Box as="DIV" sx={{ p: 1 }} />;`,
    { expectConverted: true }
  ),
  t(
    'A.nested-text-box',
    'A',
    `import { Box, Text } from '@pkgs/ui';\nexport const A = (p: { t: string }) => <Text label={p.t}><Box sx={{ p: 1 }}>x</Box></Text>;`,
    { expectConverted: true }
  ),
  t(
    'A.nested-deep',
    'A',
    `${BOX}export const A = () => <Box sx={{ p: 1 }}><Box sx={{ p: 2 }}><Box sx={{ p: 3 }}>x</Box></Box></Box>;`,
    { expectConverted: true }
  ),
  t(
    'A.stack-static',
    'A',
    `${STACK}export const A = () => <Stack direction="horizontal" spacing={2} align="center"><i /></Stack>;`,
    { expectConverted: true }
  ),
  t(
    'A.stack-dynamic',
    'A',
    `${STACK}export const A = (p: { d: 'horizontal' }) => <Stack direction={p.d} />;`,
    { expectConverted: true }
  ),
  t('A.center', 'A', `${CENTER}export const A = () => <Center>x</Center>;`, {
    expectConverted: true,
  }),
  t('A.spacer', 'A', `${SPACER}export const A = () => <Spacer />;`, {
    expectConverted: true,
  }),
  t(
    'A.card',
    'A',
    `${CARD}export const A = () => <Card sx={{ p: 1 }}>x</Card>;`
  ),
  t('A.divider', 'A', `${DIV}export const A = () => <Divider />;`),
  t(
    'A.class-literal-merge',
    'A',
    `${BOX}export const A = () => <Box sx={{ p: 1 }} class="extra" />;`,
    { expectConverted: true }
  ),
  t(
    'A.class-expr-classlist',
    'A',
    `${BOX}export const A = (p: { c: string }) => <Box sx={{ p: 1 }} class={p.c} />;`,
    { expectConverted: true }
  ),
  t(
    'A.passthrough-handlers',
    'A',
    `${BOX}export const A = (p: { onClick: () => void }) => <Box sx={{ p: 1 }} id="a" aria-label="b" onClick={p.onClick}>hi</Box>;`,
    { expectConverted: true }
  ),
  t(
    'A.shadowed-local-box',
    'A',
    `${BOX}function Box(p: { x: number }) { return p.x; }\nexport const A = Box({ x: 1 });`
  ),
  t(
    'A.shadowed-param-box',
    'A',
    `${BOX}export const A = (Box: number) => <Box sx={{ p: 1 }} />;`
  ),
  t(
    'A.shadowed-nested-const',
    'A',
    `${BOX}export const A = () => <Box sx={{ p: 1 }} />;\nfunction inner() { const Box = 1; return Box; }`,
    { expectConverted: true }
  ),
  t(
    'A.aliased-import',
    'A',
    `import { Box as B } from '@pkgs/ui';\nexport const A = () => <B sx={{ p: 1 }} />;`,
    { expectConverted: true }
  ),
  t(
    'A.relative-box-import',
    'A',
    `import { Box } from '../box';\nexport const A = () => <Box sx={{ p: 2 }} />;`,
    { expectConverted: true }
  ),

  // B
  boxSx('B.pure-literal', `{ p: 2 }`),
  boxSx('B.accessor-value', `{ height: p.h() }`),
  boxSx('B.props-value', `{ width: p.x }`),
  boxSx('B.ternary-value', `{ p: p.c ? 2 : 1 }`),
  boxSx('B.nullish-value', `{ p: p.x ?? 1 }`),
  boxSx('B.template-value', `{ width: \`\${p.x}%\` }`),
  boxSx('B.arithmetic-value', `{ p: p.x + 1 }`),
  boxSx('B.math-value', `{ p: Math.max(p.x, 1) }`),
  boxSx('B.helper-call-value', `{ p: Number(p.x) }`),
  boxSx('B.lookup-table-value', `{ p: ({ a: 1 } as const)['a'] }`),
  boxSx('B.as-const-value', `{ p: 2 as const }`),
  t(
    'B.comments-in-literal',
    'B',
    `${BOX}export const A = () => <Box sx={{ /* pad */ p: 2 }} />;`,
    { expectConverted: true }
  ),
  t(
    'B.multiline-sx',
    'B',
    `${BOX}export const A = () => <Box sx={{\n  p: 2,\n  m: 1,\n}} />;`,
    { expectConverted: true }
  ),
  t(
    'B.ident-sx',
    'B',
    `${BOX}export const A = (sx: never) => <Box sx={sx} />;`,
    { expectConverted: true }
  ),
  t(
    'B.ident-props-sx',
    'B',
    `${BOX}export const A = (props: { sx: never }) => <Box sx={props.sx} />;`,
    { expectConverted: true }
  ),
  t(
    'B.ident-local-sx',
    'B',
    `${BOX}export const A = (local: { sx: never }) => <Box sx={local.sx} />;`,
    { expectConverted: true }
  ),
  t(
    'B.ident-body-sx',
    'B',
    `${BOX}export const A = (body: { sx: never }) => <Box sx={body.sx} />;`,
    { expectConverted: true }
  ),
  t(
    'B.ident-module-const',
    'B',
    `${BOX}const paneSx = { p: 1 } as const;\nexport const A = () => <Box sx={paneSx} />;`,
    { expectConverted: true }
  ),
  t(
    'B.ident-fn-local-const',
    'B',
    `${BOX}export const A = () => { const s = { p: 1 } as const; return <Box sx={s} />; };`,
    { expectConverted: true }
  ),
  boxSx('B.array-ident-first', `[p.sx, { p: 1 }]`),
  boxSx('B.array-ident-last', `[{ p: 1 }, p.sx]`),
  boxSx('B.array-cond-and', `[{ p: 1 }, p.c && { m: 1 }]`),
  boxSx('B.array-ternary-member', `[{ p: 1 }, p.c ? { m: 1 } : null]`),
  boxSx('B.array-false-member', `[{ p: 1 }, false, undefined]`),
  boxSx('B.array-fn-call-member', `[{ p: 1 }, (() => ({ m: 1 }))()]`),
  boxSx('B.array-nested', `[[{ p: 1 }], { m: 1 }]`),
  t(
    'B.array-const-first',
    'B',
    `${BOX}const C = { p: 1 } as const;\nexport const A = () => <Box sx={[C, { m: 1 }]} />;`,
    { expectConverted: true }
  ),
  boxSx('B.top-ternary-ident', `p.c ? p.sx : p.sx`),
  boxSx('B.top-ternary-undef', `p.c ? { p: 1 } : undefined`),
  boxSx('B.top-ternary-empty', `p.c ? { p: 1 } : {}`),
  boxSx('B.top-ternary-spread', `p.c ? { ...{ p: 1 }, m: 1 } : { p: 2 }`),
  t(
    'B.top-ternary-multiline',
    'B',
    `${BOX}export const A = (p: { c: boolean }) => <Box sx={p.c\n  ? { p: 1 }\n  : { p: 2 }} />;`,
    { expectConverted: true }
  ),
  t(
    'B.call-zero-arg',
    'B',
    `${BOX}export const A = (h: () => never) => <Box sx={h()} />;`,
    { expectConverted: true }
  ),
  t(
    'B.call-positional',
    'B',
    `${BOX}const f = (_n: number): never => ({ p: 1 } as never);\nexport const A = () => <Box sx={f(1)} />;`,
    { expectConverted: true }
  ),
  t(
    'B.call-object-arg',
    'B',
    `${BOX}const f = (_o: { n: number }): never => ({ p: 1 } as never);\nexport const A = () => <Box sx={f({ n: 1 })} />;`,
    { expectConverted: true }
  ),
  t(
    'B.call-wrapper-sx',
    'B',
    `${BOX}const wrap = (sx: never) => sx;\nexport const A = (p: { sx: never }) => <Box sx={wrap(p.sx)} />;`,
    { expectConverted: true }
  ),
  t(
    'B.spread-const-first',
    'B',
    `${BOX}const C = { p: 1 } as const;\nexport const A = () => <Box sx={{ ...C, m: 1 }} />;`,
    { expectConverted: true }
  ),
  t(
    'B.spread-last',
    'B',
    `${BOX}const C = { m: 1 } as const;\nexport const A = () => <Box sx={{ p: 1, ...C }} />;`,
    { expectConverted: true }
  ),
  boxSx('B.spread-conditional', `{ p: 1, ...(p.c ? { m: 1 } : {}) }`),
  t(
    'B.spread-accessor',
    'B',
    `${BOX}export const A = (h: () => object) => <Box sx={{ p: 1, ...h() }} />;`,
    { expectConverted: true }
  ),
  t(
    'B.spread-attr-sx',
    'B',
    `${BOX}export const A = (p: { rest: { sx?: never } }) => <Box {...p.rest} />;`
  ),
  t(
    'B.spread-props-onto-primitive',
    'B',
    `${BOX}export const A = (props: never) => <Box {...props} />;`
  ),

  // C (map + a few transform)
  m('C.scaled-fractional', { p: 0.5, m: 1.5, gap: 2.5 }),
  m('C.scaled-negative-literal', { m: -2 }),
  t(
    'C.scaled-negated-ident',
    'C',
    `${BOX}export const A = (p: { x: number }) => <Box sx={{ m: -p.x }} />;`,
    { expectConverted: true }
  ),
  m('C.dim-number', { width: 10 }),
  m('C.dim-100pct', { width: '100%' }),
  t(
    'C.dim-pct-template',
    'C',
    `${BOX}export const A = (p: { n: number }) => <Box sx={{ width: \`\${p.n}%\` }} />;`,
    { expectConverted: true }
  ),
  m('C.dim-auto', { width: 'auto' }),
  m('C.dim-calc-env', { paddingTop: 'calc(env(safe-area-inset-top))' }),
  m('C.dim-var-ui', { height: 'var(--ui-duration-fast)' }),
  m('C.color-token', { color: 'tint' }),
  m('C.color-alias-danger', { color: 'danger' }),
  m('C.color-transparent', { background: 'transparent' }),
  m('C.color-raw-hex', { color: '#fff' }),
  t(
    'C.color-theme-runtime',
    'C',
    `${BOX}export const A = (theme: { colors: { tint: string } }) => <Box sx={{ color: theme.colors.tint }} />;`,
    { expectConverted: true }
  ),
  t(
    'C.color-oncolor-text',
    'C',
    `${TEXT}export const A = () => <Text color="tint" label="x" />;`,
    { expectConverted: true }
  ),
  m('C.radius-key', { borderRadius: 'md' }),
  m('C.radius-number', { borderRadius: 8 }),
  m('C.fontsize-key', { fontSize: 'md' }),
  m('C.fontsize-number', { fontSize: 14 }),
  m('C.lineheight-key-quirk', { lineHeight: 'tight' }),
  m('C.lineheight-number', { lineHeight: 20 }),
  m('C.fontweight-string', { fontWeight: 'bold' }),
  m('C.fontweight-number', { fontWeight: 700 }),
  m('C.borderwidth-hairline', {
    borderTopWidth: 'hairline',
    borderRightWidth: 'hairline',
    borderBottomWidth: 'hairline',
    borderLeftWidth: 'hairline',
  }),
  m('C.border-style', { borderStyle: 'dashed' }),
  m('C.border-corner-radii', {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  }),
  m('C.transform-static', {
    transform: [{ translateX: 1 }, { scale: 2 }] as never,
  }),
  t(
    'C.transform-dynamic',
    'C',
    `${BOX}export const A = (p: { x: number }) => <Box sx={{ transform: [{ translateX: p.x }] }} />;`,
    { expectConverted: true }
  ),
  m('C.fontvariant-array', { fontVariant: ['tabular-nums'] as never }),
  m('C.absolute-fill-true', { absoluteFill: true }),
  m('C.absolute-fill-false', { absoluteFill: false }),
  m('C.elevation-static', { elevation: 1 }),
  t(
    'C.elevation-dynamic',
    'C',
    `${BOX}export const A = (p: { e: 1 }) => <Box sx={{ elevation: p.e }} />;`,
    { expectConverted: true }
  ),
  m('C.elevation-with-bg', { elevation: 1, background: 'surface' }),
  m('C.boxshadow-vs-elevation', { elevation: 1, boxShadow: '0 0 1px #000' }),
  m('C.bg-vs-bgcolor', { background: 'surface', backgroundColor: 'tint' }),
  m('C.display-grid', { display: 'grid' }),
  m('C.grid-template-literal', { gridTemplateColumns: '1fr 1fr' }),
  t(
    'C.grid-template-template',
    'C',
    `${BOX}export const A = (p: { n: number }) => <Box sx={{ gridTemplateColumns: \`repeat(\${p.n}, 1fr)\` }} />;`,
    { expectConverted: true }
  ),
  t(
    'C.grid-column-template',
    'C',
    `${BOX}export const A = (p: { n: number }) => <Box sx={{ gridColumn: \`span \${p.n}\` }} />;`,
    { expectConverted: true }
  ),
  m('C.inset', { inset: 0 }),
  m('C.zindex', { zIndex: 10 }),
  m('C.pointer-events-auto', { pointerEvents: 'auto' }),
  t(
    'C.cursor-ternary',
    'C',
    `${BOX}export const A = (p: { c: boolean }) => <Box sx={{ cursor: p.c ? 'pointer' : 'default' }} />;`,
    { expectConverted: true }
  ),
  m('C.user-select', { userSelect: 'none' }),
  m('C.whitespace', { whiteSpace: 'nowrap' }),
  m('C.letterspacing-neg', { letterSpacing: -1 }),
  m('C.text-transform', { textTransform: 'uppercase' }),
  m('C.font-style', { fontStyle: 'italic' }),
  m('C.line-clamp', { lineClamp: 2 }),
  t(
    'C.transition-property-concat',
    'C',
    `${BOX}export const A = () => <Box sx={{ transitionProperty: 'opacity' + ',transform' }} />;`,
    { expectConverted: true }
  ),
  m('C.transition-duration-var', {
    transitionDuration: 'var(--ui-duration-fast)',
  }),
  t(
    'C.animation-delay-dyn',
    'C',
    `${BOX}export const A = (p: { d: string }) => <Box sx={{ animationDelay: p.d }} />;`,
    { expectConverted: true }
  ),
  t(
    'E.scrollview-framesx-only',
    'E',
    `${SCROLL}export const A = () => <ScrollView frameSx={{ flex: 1 }}>x</ScrollView>;`
  ),
  m('C.scroll-snap-framesx', {
    scrollSnapType: 'x mandatory',
    scrollSnapAlign: 'start',
  }),
  m('C.aspect-ratio', { aspectRatio: 16 / 9 }),
  m('C.underscore-arbitrary', { width: 'calc(1px_+_1px)' }),
  m('C.every-sxprops-key', { p: 1, color: 'tint', display: 'flex', zIndex: 1 }),

  // D
  t(
    'D.clickable-tint',
    'D',
    `${CLICK}export const A = () => <Clickable sx={{ p: 2 }}>x</Clickable>;`,
    { expectConverted: true }
  ),
  t(
    'D.clickable-opacity',
    'D',
    `${CLICK}export const A = () => <Clickable feedback="opacity" />;`,
    { expectConverted: true }
  ),
  t(
    'D.clickable-none',
    'D',
    `${CLICK}export const A = () => <Clickable feedback="none" />;`,
    { expectConverted: true }
  ),
  t(
    'D.clickable-unknown',
    'D',
    `${CLICK}export const A = () => <Clickable feedback="bogus" />;`,
    { expectConverted: true }
  ),
  t(
    'D.clickable-dynamic',
    'D',
    `${CLICK}export const A = (p: { f: 'tint' }) => <Clickable feedback={p.f} />;`,
    { expectConverted: true }
  ),
  t(
    'D.clickable-type',
    'D',
    `${CLICK}export const A = () => <Clickable type="submit" />;`,
    { expectConverted: true }
  ),
  t(
    'D.text-variant-static',
    'D',
    `${TEXT}export const A = () => <Text variant="heading" label="x" />;`,
    { expectConverted: true }
  ),
  t(
    'D.text-variant-dynamic',
    'D',
    `${TEXT}export const A = (p: { v: 'heading' }) => <Text variant={p.v} label="x" />;`,
    { expectConverted: true }
  ),
  t(
    'D.text-as-over-variant',
    'D',
    `${TEXT}export const A = () => <Text as="span" variant="heading" label="x" />;`,
    { expectConverted: true }
  ),
  t(
    'D.text-label-children',
    'D',
    `${TEXT}export const A = (p: { t: string }) => <Text label={p.t}>fallback</Text>;`,
    { expectConverted: true }
  ),
  t(
    'D.text-nolines-static',
    'D',
    `${TEXT}export const A = () => <Text numberOfLines={2} label="x" />;`,
    { expectConverted: true }
  ),
  t(
    'D.text-nolines-dynamic',
    'D',
    `${TEXT}export const A = (p: { n: number }) => <Text numberOfLines={p.n} label="x" />;`,
    { expectConverted: true }
  ),
  t(
    'D.text-color-extract',
    'D',
    `${TEXT}export const A = () => <Text sx={{ color: 'tint' }} label="hi" />;`,
    { expectConverted: true }
  ),

  // E hosts (smoke — may be untouched until host converters land)
  t(
    'E.scrollview-sx-only',
    'E',
    `${SCROLL}export const A = () => <ScrollView sx={{ p: 1 }}>x</ScrollView>;`
  ),
  t(
    'E.scrollview-both',
    'E',
    `${SCROLL}export const A = () => <ScrollView sx={{ p: 1 }} frameSx={{ flex: 1 }}>x</ScrollView>;`
  ),
  t(
    'E.scrollview-neither',
    'E',
    `${SCROLL}export const A = () => <ScrollView>x</ScrollView>;`
  ),
  t(
    'E.scrollview-framesx-array',
    'E',
    `${SCROLL}export const A = (local: { frameSx: never }) => <ScrollView frameSx={[{ flex: 1 }, local.frameSx]}>x</ScrollView>;`
  ),
  t(
    'E.scrollview-flex-detect',
    'E',
    `${SCROLL}export const A = () => <ScrollView frameSx={{ flex: 1, flexGrow: 1 }}>x</ScrollView>;`
  ),
  t(
    'E.virtuallist',
    'E',
    `import { VirtualList } from '@pkgs/ui';\nexport const A = () => <VirtualList sx={{ p: 1 }} frameSx={{ flex: 1 }} />;`
  ),
  t(
    'E.screen-body-scroll',
    'E',
    `import { ScreenBodyScrollView } from '@pkgs/ui';\nexport const A = () => <ScreenBodyScrollView sx={{ p: 1 }} />;`
  ),
  t(
    'E.motion-sx',
    'E',
    `import { Motion } from '@pkgs/ui';\nexport const A = () => <Motion sx={{ opacity: 1 }}>x</Motion>;`
  ),
  t(
    'E.motion-enter',
    'E',
    `import { Motion } from '@pkgs/ui';\nexport const A = () => <Motion enterSx={{ opacity: 0 }}>x</Motion>;`
  ),
  t(
    'E.motion-exit',
    'E',
    `import { Motion } from '@pkgs/ui';\nexport const A = () => <Motion exitSx={{ opacity: 0 }}>x</Motion>;`
  ),
  t(
    'E.motion-default-enter',
    'E',
    `import type { SxInput } from '@pkgs/ui';\nconst DEFAULT_ENTER: SxInput = { opacity: 0 };\nexport const A = DEFAULT_ENTER;`
  ),
  t(
    'E.island',
    'E',
    `import { Island } from '@pkgs/ui';\nexport const A = () => <Island sx={{ gridColumn: 'span 2' }}>x</Island>;`
  ),
  t(
    'E.gradient-box',
    'E',
    `import { GradientBox } from '@pkgs/ui';\nexport const A = () => <GradientBox sx={{ p: 1 }}>x</GradientBox>;`
  ),
  t(
    'E.focus-trap',
    'E',
    `import { FocusTrap } from '@pkgs/ui';\nexport const A = (p: { sheet: boolean }) => <FocusTrap sx={p.sheet ? { inset: 0 } : { position: 'absolute' }} />;`
  ),
  t(
    'E.spinner-box',
    'E',
    `import { SpinnerBox } from '@pkgs/ui';\nexport const A = () => <SpinnerBox sx={{ p: 1 }} />;`
  ),
  t(
    'E.menu-list',
    'E',
    `import { MenuList } from '@pkgs/ui';\nexport const A = (props: { sx: never; edge: number }) => <MenuList sx={[props.sx, props.edge ? { mx: -1 } : false]} />;`
  ),
  t(
    'E.data-table',
    'E',
    `import { DataTable } from '@pkgs/ui';\nconst dataTableShellSx = (sx: never) => sx;\nexport const A = (props: { sx: never }) => <DataTable sx={dataTableShellSx(props.sx)} />;`
  ),
  t(
    'E.icon-sx',
    'E',
    `import { ChevronDownIcon } from '@pkgs/ui';\nexport const A = () => <ChevronDownIcon sx={{ color: 'tint' }} />;`
  ),
  t(
    'E.example-root',
    'E',
    `import { ExampleRoot } from '@pkgs/ui';\nexport const A = () => <ExampleRoot sx={{ p: 1 }}>x</ExampleRoot>;`
  ),
  t(
    'E.textinput-fieldsx',
    'E',
    `import { TextInput } from '@pkgs/ui';\nexport const A = () => <TextInput fieldSx={{ p: 1 }} />;`
  ),
  t(
    'E.wrapper-space-card',
    'E',
    `import { SpaceCardGradientBox } from '@libs/spaces/public/space-card';\nexport const A = () => <SpaceCardGradientBox sx={{ p: 1 }} />;`
  ),
  t(
    'E.wrapper-username',
    'E',
    `import { UserUsername } from '@libs/profile/public/user-username';\nexport const A = () => <UserUsername sx={{ color: 'tint' }} />;`
  ),
  t(
    'E.wrapper-space-title',
    'E',
    `import { SpaceTitleText } from '@libs/spaces/public/space-title';\nexport const A = () => <SpaceTitleText sx={{ p: 1 }} />;`
  ),
  t(
    'E.wrapper-guest-host',
    'E',
    `${TEXT}export const A = () => <Text sx={{ color: 'tint' }} label="guest" />;`,
    { expectConverted: true }
  ),
  t(
    'E.wrapper-account-device',
    'E',
    `${TEXT}export const A = () => <Text sx={{ fontSize: 'sm' }} label="device" />;`,
    { expectConverted: true }
  ),
  t(
    'E.wrapper-friend-screen',
    'E',
    `${BOX}export const A = () => <Box sx={{ p: 2 }}>friend</Box>;`,
    { expectConverted: true }
  ),
  t(
    'E.wrapper-profile-handle',
    'E',
    `${BOX}export const A = (props: { sx?: never }) => <Box sx={props.sx} />;`,
    { expectConverted: true }
  ),
  t(
    'E.forwarder-decl',
    'E',
    `import type { SxInput } from '@pkgs/ui';\nexport type P = { sx?: SxInput };\nexport const A = (_p: P) => null;`
  ),
  t(
    'E.forwarder-callsite',
    'E',
    `${BOX}export const Child = (p: { sx?: never }) => <Box sx={p.sx} />;\nexport const A = () => <Child sx={{ p: 1 }} />;`,
    { expectConverted: true }
  ),
  t(
    'E.screenbase-render-prop',
    'E',
    `import { ScreenBase } from '@pkgs/ui';\nexport const A = () => <ScreenBase content={({ sx }) => <div style={sx as never} />} />;`
  ),
  t(
    'E.screenbase-sx-merge',
    'E',
    `${BOX}export const A = (sx: never) => <Box sx={[sx, { gap: 5 }]} />;`,
    { expectConverted: true }
  ),

  // F
  t(
    'F.typed-sxprops-const',
    'F',
    `import type { SxProps } from '@pkgs/ui';\nexport const fooSx: SxProps = { p: 2 };\nexport const A = fooSx;`
  ),
  t(
    'F.as-const-sx',
    'F',
    `export const fooSx = { p: 2 } as const;\nexport const A = fooSx;`
  ),
  t(
    'F.helper-return-sx',
    'F',
    `import type { SxProps } from '@pkgs/ui';\nexport const rowSx = (): SxProps => ({ p: 1 });\nexport const A = rowSx();`
  ),
  t(
    'F.helper-inline-single',
    'F',
    `${BOX}const hitBoxSx = () => ({ p: 1 } as const);\nexport const A = () => <Box sx={hitBoxSx()} />;`,
    { expectConverted: true }
  ),
  t(
    'F.test-build-body-sx',
    'F',
    `export const buildBodyContentProps = () => ({ sx: { p: 1 } });\nexport const A = buildBodyContentProps();`
  ),

  // G
  t(
    'G.dataset-static',
    'G',
    `${BOX}export const A = () => <Box sx={{ p: 1 }} dataSet={{ testid: 'x' }} />;`,
    { expectConverted: true }
  ),
  t(
    'G.dataset-spread',
    'G',
    `${BOX}export const A = (props: { dataSet: never }) => <Box sx={{ p: 1 }} dataSet={{ ...props.dataSet }} />;`,
    { expectConverted: true }
  ),
  t(
    'G.dataset-dynamic-ternary',
    'G',
    `${BOX}export const A = (p: { c: boolean }) => <Box sx={{ p: 1 }} dataSet={{ testid: p.c ? 'a' : 'b' }} />;`,
    { expectConverted: true }
  ),
  t(
    'G.dataset-dynamic-template',
    'G',
    `${BOX}export const A = (p: { id: string }) => <Box sx={{ p: 1 }} dataSet={{ testid: \`t-\${p.id}\` }} />;`,
    { expectConverted: true }
  ),
  t(
    'G.dataset-dynamic-string',
    'G',
    `${BOX}export const A = (p: { n: number }) => <Box sx={{ p: 1 }} dataSet={{ testid: String(p.n) }} />;`,
    { expectConverted: true }
  ),
  t(
    'G.dataset-dynamic-call',
    'G',
    `${BOX}export const A = (f: () => string) => <Box sx={{ p: 1 }} dataSet={{ testid: f() }} />;`,
    { expectConverted: true }
  ),
  t(
    'G.dataset-expr',
    'G',
    `${BOX}export const A = (p: { d: never }) => <Box sx={{ p: 1 }} dataSet={p.d} />;`,
    { expectConverted: true }
  ),
  t(
    'G.dataset-invalid-keys',
    'G',
    `${BOX}export const A = () => <Box sx={{ p: 1 }} dataSet={{ 'a b': 'x' }} />;`,
    { expectConverted: true }
  ),

  // H
  t('H.no-cn', 'H', `${BOX}export const A = () => <Box sx={{ p: 1 }} />;`, {
    expectConverted: true,
  }),
  t('H.no-clsx', 'H', `${BOX}export const A = () => <Box sx={{ p: 1 }} />;`, {
    expectConverted: true,
  }),
  t(
    'H.no-classnames',
    'H',
    `${BOX}export const A = () => <Box sx={{ p: 1 }} />;`,
    { expectConverted: true }
  ),
  t(
    'H.no-twmerge',
    'H',
    `${BOX}export const A = () => <Box sx={{ p: 1 }} />;`,
    { expectConverted: true }
  ),
  t('H.no-twjoin', 'H', `${BOX}export const A = () => <Box sx={{ p: 1 }} />;`, {
    expectConverted: true,
  }),
  t('H.no-cx', 'H', `${BOX}export const A = () => <Box sx={{ p: 1 }} />;`, {
    expectConverted: true,
  }),
  t('H.no-cva', 'H', `${BOX}export const A = () => <Box sx={{ p: 1 }} />;`, {
    expectConverted: true,
  }),
  t(
    'H.no-joinclass',
    'H',
    `${BOX}export const A = () => <Box sx={{ p: 1 }} />;`,
    { expectConverted: true }
  ),
  t(
    'H.no-helper-import',
    'H',
    `${BOX}export const A = () => <Box sx={{ p: 1 }} />;`,
    { expectConverted: true }
  ),
  t(
    'H.only-dataattrs-inject',
    'H',
    `${BOX}export const A = (p: { d: never }) => <Box sx={{ p: 1 }} dataSet={p.d} />;`,
    { expectConverted: true }
  ),
  t(
    'H.style-dash-case',
    'H',
    `${BOX}export const A = (p: { w: number }) => <Box sx={{ width: p.w }} />;`,
    { expectConverted: true }
  ),
  t(
    'H.style-string-preexisting',
    'H',
    `${BOX}export const A = () => <Box sx={{ p: 1 }} style="color:red" />;`,
    { expectConverted: true }
  ),
  t(
    'H.class-before-classlist',
    'H',
    `${BOX}export const A = (p: { c: string }) => <Box sx={{ p: 1 }} class={p.c} />;`,
    { expectConverted: true }
  ),
  t(
    'H.no-reactive-class-with-list',
    'H',
    `${BOX}export const A = (p: { c: string }) => <Box sx={{ p: 1 }} class={p.c} />;`,
    { expectConverted: true }
  ),

  // I
  t('I.unparseable', 'I', `${BOX}export const A = <Box sx={{ p: ;`, {
    expectParseError: true,
  }),
  t(
    'I.transform-error-parse',
    'I',
    `${BOX}export const A = () => <Box sx={{ p: 1 }} />;`,
    { expectConverted: true }
  ),
  t(
    'I.idempotence',
    'I',
    `${BOX}export const A = () => <Box sx={{ p: 1 }} />;`,
    { expectConverted: true }
  ),
  t(
    'I.unrelated-imports',
    'I',
    `import { Box, Button } from '@pkgs/ui';\nexport const A = () => <><Box sx={{ p: 1 }} /><Button /></>;`,
    { expectConverted: true }
  ),
  t(
    'I.comments-preserved',
    'I',
    `${BOX}/* keep */\nexport const A = () => <Box sx={{ p: 1 }} />;`,
    { expectConverted: true }
  ),
  t(
    'I.no-todo-marker',
    'I',
    `${BOX}export const A = () => <Box sx={{ p: 1 }} />;`,
    { expectConverted: true }
  ),
  t(
    'I.manual-zero',
    'I',
    `${BOX}export const A = () => <Box sx={{ p: 1 }} />;`,
    { expectConverted: true }
  ),
  { id: 'I.completeness-gate', family: 'I', kind: 'gate' },
];
