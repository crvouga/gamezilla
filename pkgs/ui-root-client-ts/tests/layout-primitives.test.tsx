/** @jsxImportSource solid-js */
/**
 * The closed layout primitives: token props in, classes out, and nothing a
 * caller could use to paint around them.
 */

import { describe, expect, test } from 'bun:test';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import {
  responsiveClass,
  responsiveTable,
} from '@pkgs/ui-root-client-ts/responsive';
import { spacingClass } from '@pkgs/ui-root-client-ts/space-classes';
import {
  Stack,
  StackHorizontal,
  StackVertical,
} from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import {
  RADIUS_TOKENS,
  SPACE_TOKENS,
  SURFACE_TONES,
} from '@pkgs/ui-root-shared-ts/token-names';
import { surfaceToneColor } from '@pkgs/ui-root-shared-ts/tones';
import { render } from '@solidjs/testing-library';
import { createSignal, For } from 'solid-js';

function classes(testId: string): readonly string[] {
  const element = document.querySelector(`[data-testid="${testId}"]`);
  if (element === null) throw new Error(`no element ${testId}`);
  return [...element.classList];
}

describe('responsive class tables', () => {
  test('a plain value takes the base class, a map one class per breakpoint', () => {
    const table = responsiveTable<'a' | 'b'>({
      a: 'a0 sm:a1 md:a2 lg:a3 xl:a4',
      b: 'b0 sm:b1 md:b2 lg:b3 xl:b4',
    });
    expect(responsiveClass(table, undefined)).toBe('');
    expect(responsiveClass(table, 'b')).toBe('b0');
    expect(responsiveClass(table, { base: 'a', md: 'b', xl: 'a' })).toBe(
      'a0 md:b2 xl:a4'
    );
    expect(responsiveClass(table, { lg: 'b' })).toBe('lg:b3');
  });

  test('a row must name a class for every breakpoint', () => {
    expect(() => responsiveTable({ a: 'a0 sm:a1' })).toThrow();
  });

  test('every spacing prop renders the utility bound to its token', () => {
    for (const token of SPACE_TOKENS) {
      expect(spacingClass({ gap: token })).toBe(`gap-ui-${token}`);
      expect(spacingClass({ padding: token })).toBe(`p-ui-${token}`);
      expect(spacingClass({ paddingX: token })).toBe(`px-ui-${token}`);
      expect(spacingClass({ paddingY: token })).toBe(`py-ui-${token}`);
      expect(spacingClass({ paddingTop: token })).toBe(`pt-ui-${token}`);
      expect(spacingClass({ paddingBottom: token })).toBe(`pb-ui-${token}`);
      expect(spacingClass({ paddingStart: token })).toBe(`ps-ui-${token}`);
      expect(spacingClass({ paddingEnd: token })).toBe(`pe-ui-${token}`);
      expect(spacingClass({ gap: { base: token, sm: token, xl: token } })).toBe(
        `gap-ui-${token} sm:gap-ui-${token} xl:gap-ui-${token}`
      );
    }
  });
});

describe('Stack', () => {
  test('vertical and horizontal stacks are boxes on one axis', () => {
    render(() => (
      <>
        <StackVertical testId="v" gap="sm" />
        <StackHorizontal testId="h" gap="sm" align="center" justify="between" />
      </>
    ));
    expect(classes('v')).toEqual(['box', 'gap-ui-sm']);
    expect(classes('h')).toEqual([
      'box',
      'flex-row',
      'items-center',
      'justify-between',
      'gap-ui-sm',
    ]);
  });

  test('direction and spacing follow breakpoint tokens', () => {
    render(() => (
      <Stack
        testId="s"
        direction={{ base: 'vertical', md: 'horizontal' }}
        gap={{ base: 'sm', lg: 'xl' }}
        paddingX={{ md: 'lg' }}
      />
    ));
    expect(classes('s')).toEqual([
      'box',
      'flex-col',
      'md:flex-row',
      'gap-ui-sm',
      'lg:gap-ui-xl',
      'md:px-ui-lg',
    ]);
  });

  test('item props: grow, shrink, self, size, overflow, position', () => {
    render(() => (
      <>
        <StackVertical
          testId="item"
          grow
          self="center"
          width="full"
          height="full"
          maxWidth="prose"
          minHeight="row"
          overflow="hidden"
          position="static"
          wrap
        />
        <StackVertical testId="shrink" shrink />
      </>
    ));
    expect(classes('item')).toEqual([
      'box',
      'flex-wrap',
      'overflow-hidden',
      'flex-1',
      'self-center',
      'w-full',
      'h-full',
      'max-w-ui-prose',
      'min-h-ui-control-lg',
      'static',
    ]);
    expect(classes('shrink')).toEqual(['box', 'shrink']);
  });

  test('props stay reactive after mount', () => {
    const [wide, setWide] = createSignal(false);
    render(() => (
      <StackVertical testId="r" gap={wide() ? 'xl' : 'xs'} hidden={wide()} />
    ));
    expect(classes('r')).toEqual(['box', 'gap-ui-xs']);
    setWide(true);
    expect(classes('r')).toEqual(['box', 'gap-ui-xl', 'hidden']);
    expect(
      document.querySelector('[data-testid="r"]')?.hasAttribute('hidden')
    ).toBe(true);
  });

  test('identity and accessibility pass through by name, nothing else does', () => {
    render(() => (
      <StackVertical
        testId="a11y"
        id="region"
        role="status"
        aria-label="Progress"
        aria-live="polite"
        aria-atomic
        inert
      />
    ));
    const element = document.getElementById('region');
    expect(element?.tagName).toBe('DIV');
    expect(element?.getAttribute('data-component')).toBe('StackVertical');
    expect(element?.getAttribute('role')).toBe('status');
    expect(element?.getAttribute('aria-label')).toBe('Progress');
    expect(element?.getAttribute('aria-live')).toBe('polite');
    expect(element?.getAttribute('aria-atomic')).toBe('true');
    expect(element?.hasAttribute('inert')).toBe(true);
    expect(element?.hasAttribute('style')).toBe(false);
  });
});

describe('Grid', () => {
  test('columns are a count per breakpoint', () => {
    render(() => (
      <>
        <Grid testId="g" columns={3} gap="md" align="start" />
        <Grid testId="gr" columns={{ base: 1, md: 2, xl: 4 }} />
      </>
    ));
    expect(classes('g')).toEqual([
      'box',
      'grid',
      'grid-cols-3',
      'items-start',
      'gap-ui-md',
    ]);
    expect(classes('gr')).toEqual([
      'box',
      'grid',
      'grid-cols-1',
      'md:grid-cols-2',
      'xl:grid-cols-4',
    ]);
  });
});

describe('Surface', () => {
  test('paints a tone, a radius and a border from tokens', () => {
    render(() => (
      <>
        <Surface testId="default" />
        <Surface
          testId="painted"
          tone="muted"
          radius="control"
          border
          padding="md"
          direction="horizontal"
        />
      </>
    ));
    expect(classes('default')).toEqual(['box', 'bg-surface']);
    expect(classes('painted')).toEqual([
      'box',
      'flex-row',
      'p-ui-md',
      'bg-surface-muted',
      'rounded-control',
      'border',
      'border-border',
    ]);
  });

  test('every tone is the fill utility of the palette role it aliases', () => {
    render(() => (
      <For each={SURFACE_TONES}>
        {(tone) => <Surface testId={`tone-${tone}`} tone={tone} />}
      </For>
    ));
    const kebab = (name: string): string =>
      name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    for (const tone of SURFACE_TONES) {
      const expected =
        tone === 'transparent'
          ? 'bg-transparent'
          : `bg-${kebab(surfaceToneColor[tone])}`;
      expect(classes(`tone-${tone}`)).toEqual(['box', expected]);
    }
  });

  test('every radius token has a class', () => {
    render(() => (
      <For each={RADIUS_TOKENS}>
        {(radius) => <Surface testId={`radius-${radius}`} radius={radius} />}
      </For>
    ));
    for (const radius of RADIUS_TOKENS) {
      expect(classes(`radius-${radius}`)).toEqual([
        'box',
        'bg-surface',
        `rounded-${radius}`,
      ]);
    }
  });
});
