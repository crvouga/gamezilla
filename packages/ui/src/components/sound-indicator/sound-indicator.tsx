/**
 * `SoundIndicator` -- compact circular badge that visualises the
 * current audio state with a speaker / speaker-slash icon. Three
 * states:
 *
 *   - `'idle'`    -> static `speaker.wave.fill`. Audio is on but
 *                    nothing is currently playing.
 *   - `'playing'` -> same speaker shape with the three wave arcs
 *                    rippling outward (see `AnimatedSpeakerWaves`).
 *                    Audio is actively playing right now.
 *   - `'muted'`   -> `speaker.slash.fill`, no animation. Audio is off.
 *
 * Purely presentational: takes a `state` and renders the matching
 * icon inside a padded round surface. It does **not** own the tap
 * target -- callers wrap it in a `Pressable` (or similar) and own
 * positioning. That keeps it reusable in any "audio on/off/playing"
 * context (avatar overlays, toolbar buttons, list rows, …).
 *
 * The playing-state ripple runs entirely on the native driver -- only
 * view `opacity` is touched per frame, so it does not cause
 * layout/paint and never blocks the JS thread. The animation is
 * mounted only while `state === 'playing'`, so swapping to `'idle'`
 * or `'muted'` instantly snaps back to a static glyph.
 *
 * Colors default to the active theme's `surface` / `text` /
 * `textSecondary` tokens, so it adapts to light and dark schemes out
 * of the box. Callers that need a deliberately mismatched look (e.g.
 * an always-light callout layered over a colored avatar) can override
 * `backgroundColor`, `color`, and `mutedColor` independently.
 *
 * @example
 * ```tsx
 * <SoundIndicator state="idle" />
 * <SoundIndicator state="playing" size={20} />
 * <SoundIndicator state="muted" />
 *
 * // Always-light callout (e.g. on top of a colored avatar)
 * <SoundIndicator
 *   state={muted ? 'muted' : isSpeaking ? 'playing' : 'idle'}
 *   backgroundColor="#fff"
 *   color="#000"
 *   mutedColor="#888"
 * />
 * ```
 */

import { type ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { IconSymbol } from '../symbol-icon';
import { AnimatedSpeakerWaves } from './animated-speaker-waves';

const DEFAULT_SIZE = 16;
/** Padding around the icon, scaled to size for visual balance. */
const PADDING_RATIO = 0.25;

export type SoundIndicatorState = 'idle' | 'playing' | 'muted';

export type SoundIndicatorProps = {
  /** Current audio state. Drives icon swap and the playing pulse. */
  state: SoundIndicatorState;
  /** Icon size in px. The badge wraps the icon with proportional padding. Defaults to `16`. */
  size?: number;
  /** Badge fill color. Defaults to the current theme's `surface` token. */
  backgroundColor?: string;
  /** Idle / playing icon color. Defaults to the current theme's `text` token. */
  color?: string;
  /** Muted-state icon color. Defaults to the current theme's `textSecondary` token. */
  mutedColor?: string;
};

export function SoundIndicator({
  state,
  size = DEFAULT_SIZE,
  backgroundColor,
  color,
  mutedColor,
}: SoundIndicatorProps): ReactNode {
  const theme = useTheme();
  const muted = state === 'muted';
  const bg = backgroundColor ?? theme.colors.surface;
  const iconColor = muted
    ? (mutedColor ?? theme.colors.textSecondary)
    : (color ?? theme.colors.text);
  const padding = Math.round(size * PADDING_RATIO);
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 999,
        padding,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {state === 'playing' ? (
        <AnimatedSpeakerWaves size={size} color={iconColor} />
      ) : (
        <IconSymbol
          name={muted ? 'speaker.slash.fill' : 'speaker.wave.fill'}
          size={size}
          color={iconColor}
        />
      )}
    </View>
  );
}
