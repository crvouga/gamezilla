/** @jsxImportSource solid-js */
/**
 * `Checkbox` -- tri-state checkbox rendered as `<button role="checkbox">`.
 */

import { type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { useThemeTokens } from '../../theme';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { Text } from '../text';

export type CheckboxProps = {
  checked: boolean;
  onToggle: (next: boolean) => void;
  /** Renders a dash instead of a checkmark; toggling resolves to `true`. */
  indeterminate?: boolean | undefined;
  label?: JSX.Element | undefined;
  disabled?: boolean | undefined;
  'aria-label'?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const BOX_SIZE = 18;

export function Checkbox(props: CheckboxProps): JSX.Element {
  const tokens = useThemeTokens();
  const indeterminate = () => props.indeterminate ?? false;
  const filled = () => props.checked || indeterminate();
  return (
    <Clickable
      role="checkbox"
      aria-checked={indeterminate() ? 'mixed' : props.checked}
      aria-label={props['aria-label']}
      disabled={props.disabled}
      onClick={() => props.onToggle(indeterminate() ? true : !props.checked)}
      dataSet={{ component: 'Checkbox', ...props.dataSet }}
      sx={{
        borderRadius: 'xs',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        minHeight: 44,
        opacity: props.disabled ? 0.5 : 1,
      }}
    >
      <Box
        sx={{
          width: BOX_SIZE,
          height: BOX_SIZE,
          borderRadius: 'xs',
          borderWidth: 1.5,
          borderStyle: 'solid',
          borderColor: filled() ? 'tint' : 'outline',
          backgroundColor: filled() ? 'tint' : 'surface',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Show when={filled()}>
          <svg
            width={BOX_SIZE - 4}
            height={BOX_SIZE - 4}
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path
              d={indeterminate() ? 'M3.5 8 H12.5' : 'M3.5 8.5 L7 12 L13 4.5'}
              fill="none"
              stroke={tokens.colors.onPrimary}
              stroke-width={2.25}
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </Show>
      </Box>
      <Show when={props.label !== undefined}>
        <Text variant="body" label={props.label} />
      </Show>
    </Clickable>
  );
}
