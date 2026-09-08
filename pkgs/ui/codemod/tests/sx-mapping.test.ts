/**
 * Exhaustive unit tests for the sx → Tailwind mapping table.
 *
 * Every property group gets exact class expectations, plus the no-
 * approximation rules: unknown tokens omit, precedence drops, and anything
 * without an exact equivalent bails for Tier C.
 */

import { describe, expect, test } from 'vitest';
import { mapSxRecord } from '../sx-mapping';

function classes(
  record: Record<string, string | number | boolean | null>,
  transformClass?: string
): string[] {
  const mapped = mapSxRecord(record, transformClass);
  expect(mapped.bailed).toEqual([]);
  return [...mapped.classes];
}

function bailed(
  record: Record<string, string | number | boolean | null>
): string[] {
  return [...mapSxRecord(record).bailed];
}

describe('scaled spacing (p: 4 = 16px)', () => {
  test('same-number utilities for multiples of 0.25', () => {
    expect(classes({ p: 4 })).toEqual(['p-4']);
    expect(classes({ px: 2 })).toEqual(['px-2']);
    expect(classes({ my: 0.5 })).toEqual(['my-0.5']);
    expect(classes({ gap: 0 })).toEqual(['gap-0']);
    expect(classes({ rowGap: 3 })).toEqual(['gap-y-3']);
    expect(classes({ columnGap: 1 })).toEqual(['gap-x-1']);
    expect(classes({ mt: 16 })).toEqual(['mt-16']);
  });
  test('non-grid numbers fall back to exact arbitrary values', () => {
    expect(classes({ p: 1 / 3 })).toEqual([`p-[${(1 / 3) * 4}px]`]);
  });
  test('negative numbers use exact arbitrary values', () => {
    expect(classes({ m: -2 })).toEqual(['m-[-8px]']);
  });
  test('non-numbers are ignored like the runtime', () => {
    expect(classes({ p: 'x' as unknown as number }).length).toBe(0);
  });
});

describe('colors', () => {
  test('tokens map 1:1 with kebab names', () => {
    expect(classes({ background: 'surface' })).toEqual(['bg-surface']);
    expect(classes({ color: 'textSecondary' })).toEqual([
      'text-text-secondary',
    ]);
    expect(classes({ borderColor: 'outline' })).toEqual(['border-outline']);
    expect(classes({ borderTopColor: 'destructive' })).toEqual([
      'border-t-destructive',
    ]);
    expect(classes({ outlineColor: 'tint' })).toEqual(['outline-tint']);
  });
  test('intent aliases resolve', () => {
    expect(classes({ color: 'danger' })).toEqual(['text-destructive']);
    expect(classes({ color: 'error' })).toEqual(['text-destructive']);
    expect(classes({ color: 'primary' })).toEqual(['text-tint']);
  });
  test('unknown bare tokens omit (never invalid CSS)', () => {
    expect(classes({ color: 'mystery' })).toEqual([]);
  });
  test('raw CSS passes through exactly', () => {
    expect(classes({ color: '#fff' })).toEqual(['text-[#fff]']);
    expect(classes({ background: 'transparent' })).toEqual(['bg-transparent']);
  });
  test('background beats backgroundColor', () => {
    expect(classes({ background: 'surface', backgroundColor: 'tint' })).toEqual(
      ['bg-surface']
    );
  });
});

describe('typography', () => {
  test('named sizes hit the identical default scale', () => {
    expect(classes({ fontSize: 'xs' })).toEqual(['text-xs']);
    expect(classes({ fontSize: '4xl' })).toEqual(['text-4xl']);
    expect(classes({ fontSize: 17 })).toEqual(['text-[17px]']);
  });
  test('named line-heights preserve the px quirk', () => {
    expect(classes({ lineHeight: 'tight' })).toEqual(['leading-[1.25px]']);
    expect(classes({ lineHeight: 26 })).toEqual(['leading-[26px]']);
  });
  test('weights map to identical values', () => {
    expect(classes({ fontWeight: 'bold' })).toEqual(['font-bold']);
    expect(classes({ fontWeight: 600 })).toEqual(['font-semibold']);
    expect(classes({ fontWeight: 'normal' })).toEqual(['font-normal']);
  });
  test('keywords', () => {
    expect(classes({ fontStyle: 'italic' })).toEqual(['italic']);
    expect(classes({ textAlign: 'center' })).toEqual(['text-center']);
    expect(classes({ textTransform: 'uppercase' })).toEqual(['uppercase']);
    expect(classes({ userSelect: 'none' })).toEqual(['select-none']);
    expect(classes({ whiteSpace: 'pre-wrap' })).toEqual([
      'whitespace-pre-wrap',
    ]);
    expect(classes({ textOverflow: 'ellipsis' })).toEqual(['text-ellipsis']);
  });
  test('combined decoration stays one declaration', () => {
    expect(classes({ textDecorationLine: 'underline line-through' })).toEqual([
      '[text-decoration-line:underline_line-through]',
    ]);
  });
  test('letter spacing', () => {
    expect(classes({ letterSpacing: 2 })).toEqual(['tracking-[2px]']);
  });
  test('textAlign auto bails', () => {
    expect(bailed({ textAlign: 'auto' })).toEqual(['textAlign']);
  });
});

describe('layout', () => {
  test('direct keywords', () => {
    expect(classes({ display: 'flex' })).toEqual(['flex']);
    expect(classes({ display: 'none' })).toEqual(['hidden']);
    expect(classes({ flexDirection: 'row' })).toEqual(['flex-row']);
    expect(classes({ alignItems: 'center' })).toEqual(['items-center']);
    expect(classes({ alignSelf: 'auto' })).toEqual(['self-auto']);
    expect(classes({ justifyContent: 'space-between' })).toEqual([
      'justify-between',
    ]);
    expect(classes({ overflow: 'hidden' })).toEqual(['overflow-hidden']);
    expect(classes({ position: 'absolute' })).toEqual(['absolute']);
    expect(classes({ visibility: 'hidden' })).toEqual(['invisible']);
  });
  test('raw lengths are never scaled', () => {
    expect(classes({ width: 5 })).toEqual(['w-[5px]']);
    expect(classes({ top: 0 })).toEqual(['top-[0]']);
    expect(classes({ width: '50%' })).toEqual(['w-[50%]']);
    expect(classes({ width: 'auto' })).toEqual(['w-auto']);
    expect(classes({ flexBasis: 10 })).toEqual(['basis-[10px]']);
    expect(classes({ start: 4 })).toEqual(['start-[4px]']);
  });
  test('raw pairs emit one arbitrary property', () => {
    expect(classes({ paddingHorizontal: 8 })).toEqual([
      '[padding-left:8px;padding-right:8px]',
    ]);
  });
  test('logical insets', () => {
    expect(classes({ paddingStart: 4 })).toEqual(['ps-[4px]']);
    expect(classes({ marginEnd: '2%' })).toEqual(['[margin-inline-end:2%]']);
  });
  test('flex keeps the Yoga contract', () => {
    expect(classes({ flex: 1 })).toEqual(['flex-1']);
    expect(classes({ flex: 0 })).toEqual(['[flex:0_1_auto]']);
    expect(classes({ flex: -1 })).toEqual(['[flex:0_1_auto]']);
    expect(classes({ flex: 2 })).toEqual(['[flex:2]']);
    expect(classes({ flexGrow: 1 })).toEqual(['grow']);
    expect(classes({ flexShrink: 0 })).toEqual(['shrink-0']);
  });
  test('borders', () => {
    expect(classes({ borderWidth: 1 })).toEqual(['border']);
    expect(classes({ borderWidth: 0 })).toEqual(['border-0']);
    expect(classes({ borderBottomWidth: 'hairline' })).toEqual(['border-b']);
    expect(classes({ borderTopWidth: 'hairline' })).toEqual([
      '[border-top-width:hairline]',
    ]);
    expect(classes({ borderWidth: 3 })).toEqual(['[border-width:3px]']);
    expect(classes({ borderStyle: 'dashed' })).toEqual(['border-dashed']);
  });
  test('opacity / cursor / z-index / aspect / inset', () => {
    expect(classes({ opacity: 0.5 })).toEqual(['opacity-50']);
    expect(classes({ opacity: 0.37 })).toEqual(['opacity-37']);
    expect(classes({ cursor: 'pointer' })).toEqual(['cursor-pointer']);
    expect(classes({ zIndex: -1 })).toEqual(['-z-1']);
    expect(classes({ aspectRatio: 1.5 })).toEqual(['aspect-[1.5]']);
    expect(classes({ inset: 4 })).toEqual(['inset-[4px]']);
  });
  test('outlines use exact arbitrary properties', () => {
    expect(classes({ outlineStyle: 'solid' })).toEqual([
      '[outline-style:solid]',
    ]);
    expect(classes({ outlineWidth: 2 })).toEqual(['[outline-width:2px]']);
    expect(classes({ outlineOffset: 1 })).toEqual(['[outline-offset:1px]']);
  });
});

describe('effects', () => {
  test('radii never use the wrong default scale', () => {
    expect(classes({ borderRadius: 'sm' })).toEqual(['rounded-[6px]']);
    expect(classes({ borderRadius: 'full' })).toEqual(['rounded-[9999px]']);
    expect(classes({ borderRadius: 'none' })).toEqual(['rounded-none']);
    expect(classes({ borderRadius: 8 })).toEqual(['rounded-[8px]']);
    expect(classes({ borderTopLeftRadius: 'lg' })).toEqual([
      'rounded-tl-[14px]',
    ]);
  });
  test('elevation maps to themed backgrounds', () => {
    expect(classes({ elevation: 2 })).toEqual(['bg-elevation-2']);
    expect(classes({ elevation: 0 })).toEqual([]);
  });
  test('elevation background drops when explicit', () => {
    expect(classes({ elevation: 2, background: 'surface' })).toEqual([
      'bg-surface',
    ]);
  });
  test('shadow / pointer / clamp / absolute fill', () => {
    expect(classes({ boxShadow: '0 1px 2px black' })).toEqual([
      '[box-shadow:0_1px_2px_black]',
    ]);
    expect(classes({ pointerEvents: 'box-none' })).toEqual([
      'pointer-events-none',
    ]);
    expect(classes({ pointerEvents: 'box-only' })).toEqual([]);
    expect(classes({ lineClamp: 3 })).toEqual(['line-clamp-3']);
    expect(classes({ absoluteFill: true })).toEqual(['absolute', 'inset-0']);
    expect(classes({ absoluteFill: false })).toEqual([]);
  });
  test('grid / animation / filter passthrough', () => {
    expect(classes({ gridTemplateColumns: '1fr 2fr' })).toEqual([
      'grid-cols-[1fr_2fr]',
    ]);
    expect(classes({ gridColumn: 'span 2' })).toEqual(['col-[span_2]']);
    expect(classes({ animationDuration: '200ms' })).toEqual([
      '[animation-duration:200ms]',
    ]);
    expect(classes({ backdropFilter: 'blur(4px)' })).toEqual([
      '[backdrop-filter:blur(4px)]',
    ]);
  });
  test('transform compiles with px rules', () => {
    expect(classes({}, '[transform:translateX(4px)_scale(2)]')).toEqual([
      '[transform:translateX(4px)_scale(2)]',
    ]);
  });
  test('unmappable props bail', () => {
    expect(bailed({ fontVariant: ['tabular-nums'] as never })).toEqual([
      'fontVariant',
    ]);
    expect(bailed({ unknownProp: 1 } as never)).toEqual(['unknownProp']);
  });
});
