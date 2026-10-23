/** @jsxImportSource solid-js */
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';

/**
 * Rectangular ActionBar control: icon/avatar + under-caption as one button.
 *
 * The media slot is always `buttonSize` tall so icon and avatar items share
 * the same footprint and under-captions line up in a row. The button is never
 * shorter than 44px (`minHeight`) so the target stays legal.
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, untrack } from 'solid-js';

const MIN_HIT_TARGET = 44;

export function ActionBarInlineCaption(props: {
  caption: JSX.Element;
}): JSX.Element {
  return (
    <p class="text textCaption line-clamp-1 text-text-secondary text-center w-full">
      {props.caption}
    </p>
  );
}

export function resolveActionA11yLabel(
  label: JSX.Element,
  override: string | undefined
): string | undefined {
  if (override !== undefined) return override;
  if (typeof label === 'string') return label;
  return undefined;
}

export type ActionBarLabeledControlProps = {
  /** Visible under-icon caption. */
  caption: JSX.Element;
  /** Full label for screen readers (defaults to caption when string). */
  label: JSX.Element;
  'aria-label'?: string | undefined;
  /** Fixed media-slot height; matches ActionBar `buttonSize`. */
  buttonSize: number;
  slotWidth: number;
  disabled?: boolean | undefined;
  onClick: () => void;
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
};

export function ActionBarLabeledControl(
  props: ActionBarLabeledControlProps
): JSX.Element {
  const onClick = (): void => {
    untrack(() => props.onClick)();
  };
  return (
    <button
      class="clickable clickableTint rounded-control items-center justify-center py-1 gap-1"
      {...dataAttrs({ component: 'ActionBarLabeledControl', ...props.dataSet })}
      type="button"
      style={{
        'min-width': cssPx(Math.max(props.slotWidth, MIN_HIT_TARGET)),
        'min-height': cssPx(MIN_HIT_TARGET),
        width: cssPx(props.slotWidth),
        'max-width': cssPx(Math.max(props.slotWidth, MIN_HIT_TARGET)),
        opacity: props.disabled === true ? 0.5 : 1,
      }}
      onClick={onClick}
      disabled={props.disabled === true}
      aria-label={resolveActionA11yLabel(props.label, props['aria-label'])}
    >
      <div
        class="box w-full items-center justify-center"
        style={{ height: cssPx(props.buttonSize) }}
      >
        {props.children}
      </div>
      <ActionBarInlineCaption caption={props.caption} />
    </button>
  );
}
