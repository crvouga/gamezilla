/** @jsxImportSource solid-js */
/**
 * `Button` -- themed `<button>` with four intents, three sizes, three variants.
 *
 * `intent` chooses the color role (primary / danger / success / neutral);
 * `variant` chooses how much visual weight that color carries:
 *   - `solid` (default) -- filled + `on*` label, looks like the primary action.
 *   - `outline` -- transparent bg + colored border + intent-colored label.
 *   - `ghost` -- transparent bg, no border, intent-colored label.
 *
 * `loading` / `feedback` drive the inline mutation faces (spinner, check,
 * retry) -- pair with `useMutationButton`. Hover/press feedback is delegated
 * to {@link Clickable}'s tint overlay.
 *
 * @example
 * ```tsx
 * <Button title="Save" intent="primary" onClick={save} />
 * <Button title="Delete" intent="danger" onClick={del} />
 * <Button title="Cancel" intent="neutral" variant="outline" onClick={cancel} />
 * ```
 */

import { createMemo, type JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import {
  OnColorProvider,
  type OnColorSet,
  spacingScale,
  useThemeTokens,
} from '../../theme';
import { Box, joinClass } from '../box';
import { Clickable } from '../clickable';
import type { IconComponent } from '../icons';
import {
  type ButtonFace,
  type ButtonFeedback,
  type ButtonIntent,
  type ButtonVariant,
  resolveButtonRender,
} from './button-face';
import {
  BUTTON_SIZES,
  ButtonContent,
  type ButtonSize,
  type ButtonSizeSpec,
} from './button-parts';

export type ButtonProps = {
  title: JSX.Element;
  onClick?: (() => void) | undefined;
  intent?: ButtonIntent | undefined;
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  /** Mutation phase; overrides `loading`. See `useMutationButton`. */
  feedback?: ButtonFeedback | undefined;
  loadingLabel?: JSX.Element | undefined;
  successLabel?: JSX.Element | undefined;
  errorLabel?: JSX.Element | undefined;
  /** Click handler while `feedback === 'error'`. Falls back to `onClick`. */
  onRetry?: (() => void) | undefined;
  /** Leading icon, sized/weighted by `size`. */
  icon?: IconComponent | undefined;
  /** Arbitrary leading node (caller-sized). */
  startIcon?: JSX.Element | undefined;
  /** Arbitrary trailing node (caller-sized). */
  endIcon?: JSX.Element | undefined;
  /** Flex weight inside a row. */
  flex?: number | undefined;
  /** Stretch to the container width. */
  fullWidth?: boolean | undefined;
  /** Form semantics. Defaults to `button`. */
  type?: 'button' | 'submit' | 'reset' | undefined;
  'aria-label'?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function buttonClass(args: {
  flex: number | undefined;
  fullWidth: boolean;
}): string {
  return joinClass(
    'flex-row items-center justify-center overflow-hidden select-none',
    args.fullWidth && 'self-stretch w-full',
    args.flex === 1 && 'flex-1'
  );
}

function buttonStyle(args: {
  flex: number | undefined;
  s: ButtonSizeSpec;
  face: ButtonFace;
}): JSX.CSSProperties {
  return {
    ...(args.flex !== undefined && args.flex !== 1
      ? { flex: String(args.flex) }
      : {}),
    'background-color': args.face.backgroundColor,
    'border-color': args.face.borderColor,
    'border-width': `${args.face.borderWidth}px`,
    'border-style': 'solid',
    'border-radius': `${args.s.borderRadius}px`,
    'padding-left': `${spacingScale(args.s.px)}px`,
    'padding-right': `${spacingScale(args.s.px)}px`,
    'padding-top': `${spacingScale(args.s.py)}px`,
    'padding-bottom': `${spacingScale(args.s.py)}px`,
    'min-height': `${args.s.minHeight}px`,
    gap: `${spacingScale(args.s.iconGap)}px`,
    'transition-property': 'background-color, border-color, color',
    'transition-duration': 'var(--ui-duration-fast)',
  };
}

export function Button(props: ButtonProps): JSX.Element {
  const tokens = useThemeTokens();
  const size = (): ButtonSizeSpec => BUTTON_SIZES[props.size ?? 'md'];
  const render = createMemo(() =>
    resolveButtonRender(tokens.colors, {
      intent: props.intent,
      variant: props.variant,
      disabled: props.disabled,
      loading: props.loading,
      feedback: props.feedback,
      onClick: props.onClick,
      onRetry: props.onRetry,
    })
  );
  const fg = (): string => render().face.foregroundColor;
  // Getter-backed so the provider's single `value` read stays reactive.
  const onColor: OnColorSet = {
    get fg() {
      return fg();
    },
    get fgMuted() {
      return fg();
    },
    get icon() {
      return fg();
    },
  };
  return (
    <Clickable
      type={props.type}
      onClick={() => render().handleClick?.()}
      disabled={render().nonInteractive}
      aria-busy={render().phase === 'loading' ? true : undefined}
      aria-label={props['aria-label']}
      class={buttonClass({
        flex: props.flex,
        fullWidth: props.fullWidth === true,
      })}
      style={buttonStyle({
        flex: props.flex,
        s: size(),
        face: render().face,
      })}
      dataSet={{
        component: 'Button',
        intent: props.intent ?? 'primary',
        variant: props.variant ?? 'solid',
        phase: render().phase,
        ...props.dataSet,
      }}
    >
      <OnColorProvider value={onColor}>
        <Box
          class="relative flex-row items-center justify-center"
          style={{ gap: `${spacingScale(size().iconGap)}px` }}
        >
          <ButtonContent
            labels={{
              get title() {
                return props.title;
              },
              get loadingLabel() {
                return props.loadingLabel;
              },
              get successLabel() {
                return props.successLabel;
              },
              get errorLabel() {
                return props.errorLabel;
              },
            }}
            phase={render().phase}
            size={size()}
            foregroundColor={fg()}
            icon={props.icon}
            startIcon={props.startIcon}
            endIcon={props.endIcon}
          />
        </Box>
      </OnColorProvider>
    </Clickable>
  );
}
