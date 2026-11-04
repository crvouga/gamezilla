/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { iconSize } from '@pkgs/ui-root-shared-ts/sizes';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { IconComponent } from '../create-icon/index';

export type StateBlockVariant = 'fill' | 'compact';

/**
 * Where the block lines up: `center` (the default) on its own, or `start`
 * on the leading edge of a column whose page title sits above it, so the
 * title and the state share one edge.
 */
export type StateBlockAlign = 'center' | 'start';

/** Glyph color inside the disc: quiet by default, the status hue otherwise. */
export type StateBlockTone = 'neutral' | 'destructive' | 'success';

export type StateBlockProps = {
  variant?: StateBlockVariant | undefined;
  /** Defaults to `center`. */
  align?: StateBlockAlign | undefined;
  children: JSX.Element;
  /** ARIA role for the block (`status`, `alert`, …). */
  role?: 'status' | 'alert' | 'region' | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `StateBlock` -- layout primitive shared by `LoadingState`, `EmptyState`,
 * `ErrorState`, and `SuccessState`.
 *
 * A centered column on the 4px grid: an optional {@link StateBlockIcon} disc,
 * the title, the body at a readable measure, then the action. Two density
 * variants:
 *   - `'fill'`    -> grows to fill the parent and centers vertically. Used
 *                    for full-screen states (Suspense fallback, empty list
 *                    page).
 *   - `'compact'` -> intrinsic height with tighter padding. Used inline as a
 *                    card or inside a scrolled section.
 *
 * Exported so sub teams can compose custom statuses with the same layout
 * contract (e.g. a payment-failed card with a custom icon set).
 */
export function StateBlock(props: StateBlockProps): JSX.Element {
  const isFill = (): boolean => (props.variant ?? 'fill') === 'fill';
  const centered = (): boolean => (props.align ?? 'center') === 'center';
  return (
    <div
      class="box w-full"
      classList={{
        'items-center justify-center px-4': centered(),
        'items-start justify-start': !centered(),
        'flex-1 py-12': isFill() && centered(),
        'py-8': !(isFill() && centered()),
      }}
      {...dataAttrs({
        component: 'StateBlock',
        variant: props.variant ?? 'fill',
        align: props.align ?? 'center',
        ...props.dataSet,
      })}
      role={props.role}
    >
      <div
        class="box w-full max-w-ui-prose gap-2"
        classList={{
          'items-center justify-center text-center': centered(),
          'items-start text-left': !centered(),
        }}
      >
        {props.children}
      </div>
    </div>
  );
}

const TONE_COLOR: Record<StateBlockTone, string> = {
  neutral: 'textSecondary',
  destructive: 'destructive',
  success: 'success',
};

/** Outline glyphs read thinner at display size, like the platform's own. */
const DISC_STROKE_WIDTH = 1.5;

export type StateBlockIconProps = {
  icon: IconComponent;
  variant?: StateBlockVariant | undefined;
  tone?: StateBlockTone | undefined;
};

/**
 * The state's glyph inside a hairline circle: a 48px outline icon in a 96px
 * disc (`fill`), or 32px in 64px (`compact`).
 */
export function StateBlockIcon(props: StateBlockIconProps): JSX.Element {
  const isFill = (): boolean => (props.variant ?? 'fill') === 'fill';
  return (
    <div
      class="box shrink-0 items-center justify-center rounded-full border border-solid border-border"
      classList={{ 'size-24 mb-2': isFill(), 'size-16 mb-1': !isFill() }}
      data-component="StateBlockIcon"
    >
      <Dynamic
        component={props.icon}
        size={isFill() ? iconSize['2xl'] : iconSize.xl}
        strokeWidth={DISC_STROKE_WIDTH}
        color={TONE_COLOR[props.tone ?? 'neutral']}
      />
    </div>
  );
}

/** The action row under a state's copy, a step below the body. */
export function StateBlockActions(props: {
  children: JSX.Element;
  /** Follows the block's {@link StateBlockAlign}. Defaults to `center`. */
  align?: StateBlockAlign | undefined;
}): JSX.Element {
  return (
    <div
      class="box mt-2 flex-row flex-wrap items-center gap-2"
      classList={{
        'justify-center': (props.align ?? 'center') === 'center',
        'justify-start': props.align === 'start',
      }}
    >
      {props.children}
    </div>
  );
}
