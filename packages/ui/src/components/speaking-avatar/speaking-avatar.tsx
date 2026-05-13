/**
 * `SpeakingAvatar` -- a DiceBear "toon-head" character rendered raw (no
 * circular crop), paired with a speech bubble that slides+fades in
 * whenever the message changes, in sync with TTS playback.
 *
 * The head SVG is rendered at its natural shape (uncropped) so the
 * cartoon character reads as *next to* the bubble rather than as a small
 * profile-photo plate. Bumping the size makes the head fill more of the
 * row, which pushes the visible face closer to the bubble's tail.
 *
 * Entrance animation lives in {@link SpeechBubble}: the whole bubble
 * (tail + surface) translates up a few px and fades in via a single
 * `Animated.Value` on every `message` change. This component is just
 * plumbing -- head graphic, bubble, and the TTS playback effect that
 * fires when `message` changes.
 *
 * Purely presentational: the message comes in as a plain string. Callers
 * resolve any i18n upstream before passing it in.
 *
 * Audio always runs through `<TtsProvider>` — there is no anonymous /
 * optional fallback. Callers MUST mount this component beneath a
 * `<TtsProvider>` (storybook previews and tests do the same in their own
 * harness) and MUST pass an explicit `voice`. Pass `speak={false}` to
 * mute audio (the bubble entrance animation still runs).
 *
 * Mute affordance: when `speak !== false`, tapping the avatar head
 * toggles a local `muted` flag and the audio kickoff in `useSpeak` is
 * gated on `!muted`. A tiny `SoundIndicator` sits in the bottom-right
 * of the head and visualises three states: `'idle'` (audio enabled,
 * nothing playing), `'playing'` (pulsing while TTS audio is actively
 * playing back), and `'muted'`. Caller-side `speak={false}` overrides
 * everything (no toggle, no indicator -- audio is permanently off).
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
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { defaultColors } from '../../theme';
import { Box } from '../box';
import { Pressable } from '../pressable';
import { SoundIndicator, type SoundIndicatorState } from '../sound-indicator';
import { speakingAvatarSvg } from './speaking-avatar-svg';
import { SpeechBubble } from './speech-bubble';

const DEFAULT_AVATAR_SIZE = 80;
const DEFAULT_SEED = '01J9H25D949E4A51ZV2N3676V1';
/** Min indicator icon size; below this, the badge becomes hard to read. */
const MIN_INDICATOR_PX = 14;
/** Indicator scales with the head so big avatars get a proportional badge. */
const INDICATOR_SCALE = 0.22;

function resolveIndicatorState(
  muted: boolean,
  isSpeaking: boolean
): SoundIndicatorState {
  if (muted) return 'muted';
  if (isSpeaking) return 'playing';
  return 'idle';
}

export type SpeakingAvatarProps = {
  message: string;
  /** Voice to speak with. Pin one of the `Voices.*` constants per call site. */
  voice?: Voice;
  /** Size of the DiceBear head graphic in pixels (width === height). Defaults to `96`. */
  avatarSize?: number;
  /** DiceBear seed (controls which face is generated). Defaults to `'speaking-avatar'`. */
  seed?: string;
  /**
   * When `true` (default), audio playback is permitted. When `false`,
   * audio is permanently off and the in-component mute toggle / icon
   * indicator are hidden (caller-controlled mute).
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
  seed = DEFAULT_SEED,
  speak = true,
  numberOfLines,
  style,
}: SpeakingAvatarProps): ReactNode {
  const svg = useMemo(
    () => speakingAvatarSvg(seed, avatarSize),
    [seed, avatarSize]
  );

  // Local mute composes with caller `speak`: audio is only enabled when
  // the caller permits speech AND the user hasn't toggled mute on the
  // avatar.
  const [muted, setMuted] = useState(false);
  const toggleMuted = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  const { isLoading, isSpeaking } = useSpeak({
    text: message,
    ...(voice ? { voice } : {}),
    enabled: speak && !muted,
  });

  const indicatorState = resolveIndicatorState(muted, isSpeaking);

  return (
    <Box
      sx={{ flexDirection: 'row', alignItems: 'center', pr: 4 }}
      style={style}
    >
      <Pressable
        onPress={toggleMuted}
        disabled={!speak}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Unmute coach' : 'Mute coach'}
        style={{ position: 'relative' }}
      >
        <SvgXml xml={svg} width={avatarSize} height={avatarSize} />
        {speak ? (
          <Box sx={{ position: 'absolute', right: 0, bottom: 0 }}>
            <SoundIndicator
              state={indicatorState}
              size={Math.max(
                MIN_INDICATOR_PX,
                Math.round(avatarSize * INDICATOR_SCALE)
              )}
              backgroundColor={defaultColors.light.surface}
              color={defaultColors.light.text}
              mutedColor={defaultColors.light.textSecondary}
            />
          </Box>
        ) : null}
      </Pressable>
      <SpeechBubble
        text={message}
        loading={isLoading}
        {...(numberOfLines !== undefined ? { numberOfLines } : {})}
      />
    </Box>
  );
}
