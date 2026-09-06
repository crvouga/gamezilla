/** @jsxImportSource solid-js */
/**
 * Rectangular ActionBar control: icon/avatar + under-caption as one button.
 *
 * The media slot is always `buttonSize` tall so icon and avatar items share
 * the same footprint and under-captions line up in a row. The button is never
 * shorter than 44px (`minHeight`) so the target stays legal.
 */

import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { Text } from '../text';

const MIN_HIT_TARGET = 44;

export function ActionBarInlineCaption(props: {
  caption: JSX.Element;
}): JSX.Element {
  return (
    <Text
      variant="caption"
      numberOfLines={1}
      sx={{ color: 'textSecondary', textAlign: 'center', width: '100%' }}
      label={props.caption}
    />
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
  return (
    <Clickable
      onClick={() => props.onClick()}
      disabled={props.disabled === true}
      aria-label={resolveActionA11yLabel(props.label, props['aria-label'])}
      dataSet={{ component: 'ActionBarLabeledControl', ...props.dataSet }}
      sx={{
        borderRadius: 'md',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: Math.max(props.slotWidth, MIN_HIT_TARGET),
        minHeight: MIN_HIT_TARGET,
        width: props.slotWidth,
        maxWidth: Math.max(props.slotWidth, MIN_HIT_TARGET),
        opacity: props.disabled === true ? 0.5 : 1,
        py: 0.5,
        gap: 0.5,
      }}
    >
      <Box
        sx={{
          height: props.buttonSize,
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {props.children}
      </Box>
      <ActionBarInlineCaption caption={props.caption} />
    </Clickable>
  );
}
