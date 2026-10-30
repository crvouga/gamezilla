/** @jsxImportSource solid-js */
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';
/**
 * `SoundIndicator` -- compact circular badge that visualises the current
 * audio state with a speaker / speaker-slash icon. Three states:
 *
 *   - `'idle'`    -> static speaker glyph. Audio is on, nothing playing.
 *   - `'playing'` -> speaker with static wave arcs.
 *   - `'muted'`   -> speaker-slash glyph. Audio is off.
 *
 * Purely presentational: it does **not** own the tap target -- callers wrap
 * it in a `Clickable` and own positioning. Exposes `role="status"` with an
 * `aria-label` naming the state so screen readers get the same signal.
 *
 * Colors default to the active theme's `surface` / `text` / `textSecondary`
 * tokens; override `backgroundColor`, `color`, and `mutedColor` for
 * deliberately mismatched looks (e.g. an always-light callout on an avatar).
 */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { resolveColor } from '@pkgs/ui-root-shared-ts/resolve-color';
import { type JSX, Show } from 'solid-js';
import { AnimatedSpeakerWaves } from '../animated-speaker-waves/index';
import { Volume2Icon, VolumeXIcon } from '../icons';
import { useThemeTokens } from '../theme-context/index';

/** Padding around the icon, scaled to size for visual balance. */
const PADDING_RATIO = 0.25;
const DEFAULT_SIZE = 16;

export type SoundIndicatorState = 'idle' | 'playing' | 'muted';

export type SoundIndicatorProps = {
  /** Current audio state. Drives icon swap and wave visibility. */
  state: SoundIndicatorState;
  /** Icon size in px. The badge wraps the icon with proportional padding. Defaults to `16`. */
  size?: number | undefined;
  /** Badge fill color (token or CSS). Defaults to the theme `surface` token. */
  backgroundColor?: string | undefined;
  /** Idle / playing icon color (token or CSS). Defaults to the theme `text` token. */
  color?: string | undefined;
  /** Muted-state icon color (token or CSS). Defaults to the theme `textSecondary` token. */
  mutedColor?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function SoundIndicator(props: SoundIndicatorProps): JSX.Element {
  const tokens = useThemeTokens();
  const { t } = useLingui();
  const size = () => props.size ?? DEFAULT_SIZE;
  const muted = () => props.state === 'muted';
  const iconColor = (): string => {
    const wanted = muted()
      ? (props.mutedColor ?? 'textSecondary')
      : (props.color ?? 'text');
    return resolveColor(wanted, tokens.colors) ?? wanted;
  };
  const backgroundColor = (): string =>
    resolveColor(props.backgroundColor ?? 'surface', tokens.colors) ??
    tokens.colors.surface;
  const stateLabel = (): string => {
    if (props.state === 'muted') return t`Sound off`;
    if (props.state === 'playing') return t`Playing`;
    return t`Sound on`;
  };
  return (
    <span
      class="box inline-flex rounded-full items-center justify-center"
      {...dataAttrs({ component: 'SoundIndicator', ...props.dataSet })}
      style={{
        'background-color': backgroundColor(),
        padding: cssPx(Math.round(size() * PADDING_RATIO)),
      }}
      role="status"
      aria-label={stateLabel()}
      data-state={props.state}
    >
      <Show
        when={props.state === 'playing'}
        fallback={
          <Show
            when={muted()}
            fallback={<Volume2Icon size={size()} color={iconColor()} />}
          >
            <VolumeXIcon size={size()} color={iconColor()} />
          </Show>
        }
      >
        <AnimatedSpeakerWaves size={size()} color={iconColor()} />
      </Show>
    </span>
  );
}
