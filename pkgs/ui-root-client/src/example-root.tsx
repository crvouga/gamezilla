/** @jsxImportSource solid-js */
/**
 * Root layout for UI explorer component examples.
 *
 * Owns shared section spacing (`gap`, default `lg`) and omits edge padding —
 * ScreenBase / ExplorerDetail already inset the body. An example that needs
 * room picks `grow` and a `minHeight`; a screen example is `bounded` (a fixed
 * viewport that exercises scrolling and pinned chrome).
 *
 * Examples never provide their own clock: the hosting app supplies
 * `ClockProvider` (wall at the process root, harness in tests).
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { SpaceToken } from '@pkgs/ui-root-shared/token-names';
import type { JSX } from 'solid-js';
import { spaced } from './layout-classes';
import { spacingClass } from './space-classes';

/** Floor on the example height: `sm` 200, `md` 360, `lg` 400. */
export type ExampleRootMinHeight = 'sm' | 'md' | 'lg';

export type ExampleRootProps = {
  children: JSX.Element;
  /** Space between sections. Default `lg`. */
  gap?: SpaceToken | undefined;
  /** Fill the explorer's leftover height. */
  grow?: boolean | undefined;
  minHeight?: ExampleRootMinHeight | undefined;
  /** A fixed, clipped, outlined viewport for screen examples. */
  bounded?: boolean | undefined;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const MIN_HEIGHT: Readonly<Record<ExampleRootMinHeight, string>> = {
  sm: 'min-h-50',
  md: 'min-h-90',
  lg: 'min-h-100',
};

export function ExampleRoot(props: ExampleRootProps): JSX.Element {
  return (
    <div
      class={spaced([
        'box',
        spacingClass({ gap: props.gap ?? 'lg' }),
        props.grow === true ? 'flex-1' : undefined,
        props.minHeight === undefined ? undefined : MIN_HEIGHT[props.minHeight],
        props.bounded === true
          ? 'h-160 min-h-0 overflow-hidden rounded-card border border-border'
          : undefined,
      ])}
      {...dataAttrs({ component: 'ExampleRoot', ...props.dataSet })}
    >
      {props.children}
    </div>
  );
}
