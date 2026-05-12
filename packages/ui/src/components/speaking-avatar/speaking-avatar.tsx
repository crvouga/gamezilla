/**
 * `SpeakingAvatar` -- a DiceBear "toon-head" character rendered raw (no
 * circular crop), paired with a speech bubble that progressively reveals
 * a message in time with TTS playback.
 *
 * The head SVG is rendered at its natural shape (uncropped) so the
 * cartoon character reads as *next to* the bubble rather than as a small
 * profile-photo plate. Bumping the size makes the head fill more of the
 * row, which pushes the visible face closer to the bubble's tail.
 *
 * Reveal animation lives in {@link SpeechBubble}: per-glyph opacity tween
 * driven off a single `Animated.Value`, no React state churn during
 * playback. This component is just plumbing -- head graphic, bubble, and
 * the TTS playback effect that fires when `message` changes.
 *
 * Purely presentational: the message comes in as a plain string. Callers
 * resolve any i18n upstream before passing it in.
 *
 * Audio always runs through `<TtsProvider>` — there is no anonymous /
 * optional fallback. Callers MUST mount this component beneath a
 * `<TtsProvider>` (storybook previews and tests do the same in their own
 * harness) and MUST pass an explicit `voice`. Pass `speak={false}` to
 * mute audio (the bubble reveal still runs).
 *
 * @example
 * ```tsx
 * <SpeakingAvatar message="Your move" voice={Voices.David} />
 * <SpeakingAvatar message={t`Solved`} voice={Voices.Sam} avatarSize={80} />
 * <SpeakingAvatar message="silent" voice={Voices.David} speak={false} />
 * ```
 */

import { useSpeak } from '@gamezilla/tts/client/use-speak';
import { type Voice } from '@gamezilla/tts/shared/tts-voice';
import { useMemo, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { speakingAvatarSvg } from './speaking-avatar-svg';
import { SpeechBubble } from './speech-bubble';

const DEFAULT_AVATAR_SIZE = 80;
const DEFAULT_CHAR_DELAY_MS = 30;
const DEFAULT_SEED = '01J9H25D949E4A51ZV2N3676V1';
const ROW_GAP = 0;

export type SpeakingAvatarProps = {
  message: string;
  /** Voice to speak with. Pin one of the `Voices.*` constants per call site. */
  voice?: Voice;
  /** Size of the DiceBear head graphic in pixels (width === height). Defaults to `96`. */
  avatarSize?: number;
  /** Milliseconds between typed characters (fallback when speech duration is unknown). Defaults to `30`. */
  charDelayMs?: number;
  /** DiceBear seed (controls which face is generated). Defaults to `'speaking-avatar'`. */
  seed?: string;
  /**
   * When `true` (default), speaks the message aloud. Set to `false` for
   * muted/decorative usage; the bubble reveal animation still runs (no
   * loading dots, since there's nothing to wait for).
   */
  speak?: boolean;
  /**
   * Lines reserved inside the speech bubble. The bubble is pinned to a
   * fixed pixel height so nothing below it (e.g. the chess board on
   * `chess-puzzle-play-screen`) can move when the message changes.
   * Defaults to `2`. Bump for callers with longer copy.
   */
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
};

export function SpeakingAvatar({
  message,
  voice,
  avatarSize = DEFAULT_AVATAR_SIZE,
  charDelayMs = DEFAULT_CHAR_DELAY_MS,
  seed = DEFAULT_SEED,
  speak = true,
  numberOfLines,
  style,
}: SpeakingAvatarProps): ReactNode {
  const svg = useMemo(
    () => speakingAvatarSvg(seed, avatarSize),
    [seed, avatarSize]
  );

  const { isLoading, durationMs } = useSpeak({
    text: message,
    ...(voice ? { voice } : {}),
    enabled: speak,
  });

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: ROW_GAP,
        },
        style,
      ]}
    >
      <SvgXml xml={svg} width={avatarSize} height={avatarSize} />
      <SpeechBubble
        text={message}
        charDelayMs={charDelayMs}
        loading={isLoading}
        {...(numberOfLines !== undefined ? { numberOfLines } : {})}
        {...(durationMs !== null ? { revealDurationMs: durationMs } : {})}
      />
    </View>
  );
}
