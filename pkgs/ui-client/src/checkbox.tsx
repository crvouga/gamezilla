/** @jsxImportSource solid-js */
/**
 * `Checkbox` -- checked / unchecked / indeterminate control.
 */

import { type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import { colorVar } from '@pkgs/ui-shared/css-vars';
import { useThemeTokens } from './theme-context';

export type CheckboxProps = {
  checked: boolean;
  onToggle: (next: boolean) => void;
  /** Optional label displayed next to the checkbox. */
  label?: JSX.Element | undefined;
  /** When true, shows the indeterminate (dash) glyph. */
  indeterminate?: boolean | undefined;
  disabled?: boolean | undefined;
  'aria-label'?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const BOX_SIZE = 20;

export function Checkbox(props: CheckboxProps): JSX.Element {
  const tokens = useThemeTokens();
  const indeterminate = () => props.indeterminate ?? false;
  const filled = () => props.checked || indeterminate();
  return (
    <button
      class="clickable clickableTint rounded-xs flex-row items-center gap-2 min-h-11"
      {...dataAttrs({ component: 'Checkbox', ...props.dataSet })}
      type="button"
      style={{ opacity: props.disabled ? 0.5 : 1 }}
      role="checkbox"
      aria-checked={indeterminate() ? 'mixed' : props.checked}
      aria-label={props['aria-label']}
      disabled={props.disabled}
      onClick={() => props.onToggle(indeterminate() ? true : !props.checked)}
    >
      <div
        class="box rounded-xs border-solid items-center justify-center"
        style={{
          width: `${BOX_SIZE}px`,
          height: `${BOX_SIZE}px`,
          'border-width': '1.5px',
          'border-color': filled() ? colorVar('tint') : colorVar('outline'),
          'background-color': filled() ? colorVar('tint') : colorVar('surface'),
        }}
      >
        <Show when={filled()}>
          <svg
            width={BOX_SIZE - 4}
            height={BOX_SIZE - 4}
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <Show
              when={!indeterminate()}
              fallback={
                <rect
                  x="3"
                  y="7"
                  width="10"
                  height="2"
                  rx="1"
                  fill={tokens.colors.onPrimary}
                />
              }
            >
              <path
                d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
                fill="none"
                stroke={tokens.colors.onPrimary}
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </Show>
          </svg>
        </Show>
      </div>
      <Show when={props.label !== undefined}>
        <p class="text text-text">{props.label}</p>
      </Show>
    </button>
  );
}
