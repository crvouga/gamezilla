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
 * toggles a `muted` flag persisted via {@link useKvState} (so the choice
 * survives reloads when an ambient `<KvProvider>` is mounted; falls back
 * to in-memory state otherwise). The audio kickoff in `useSpeak` is
 * gated on `!muted` and on {@link useScreenAudible} (route focused + app
 * foreground). Navigating away or backgrounding flips `enabled` off so
 * `useSpeak` aborts synthesis and stops in-progress playback. A tiny
 * `SoundIndicator` sits in the bottom-right of the head and visualises
 * three states: `'idle'` (audio enabled, nothing playing), `'playing'`
 * (pulsing while TTS audio is actively playing back), and `'muted'`.
 * Caller-side `speak={false}` overrides everything (no toggle, no
 * indicator -- audio is permanently off).
 *
 * @example
 * ```tsx
 * <SpeakingAvatar message="Your move" voice={Voices.David} />
 * <SpeakingAvatar message={t`Solved`} voice={Voices.Sam} avatarSize={80} />
 * <SpeakingAvatar message="silent" voice={Voices.David} speak={false} />
 * ```
 */

import { asKeyword } from '@pkgs/keyword/keyword';
import { booleanKvCodec } from '@pkgs/kv/kv-state-codec';
import { useKvState } from '@pkgs/kv/use-kv-state';
import { useSpeak } from '@pkgs/tts/client/use-speak';
import { type Voice } from '@pkgs/tts/shared/tts-voice';
import { useCallback, useMemo, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import {
  componentDataSet,
  type ComponentDataSet,
} from '../../component-id';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { Pressable } from '../pressable';
import { SoundIndicator, type SoundIndicatorState } from '../sound-indicator';
import { SPEAKING_AVATAR_SVG } from './speaking-avatar-svg';
import { SpeechBubble } from './speech-bubble';
import { useScreenAudible } from './use-screen-audible';

const MUTED_ROW_KEY = asKeyword('ui/speaking-avatar-muted');
const MUTED_VALUE_ATTR = asKeyword('ui/value');
const MUTED_CODEC = booleanKvCodec(MUTED_VALUE_ATTR);

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
  /** Rendered above the bubble text (see {@link SpeechBubble}). */
  header?: React.ReactNode;
  /**
   * When true, the speech bubble shows the typing indicator (e.g. while an
   * LLM-backed coach line is loading). TTS stays off until this is false and
   * `message` is non-empty.
   */
  bubbleResolving?: boolean;
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
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function SpeakingAvatar({
  message,
  header,
  bubbleResolving = false,
  numberOfLines,
  style,
  dataSet,
}: SpeakingAvatarProps): ReactNode {
  const theme = useTheme();
  const svg = useMemo(() => SPEAKING_AVATAR_SVG, []);

  const [muted, setMuted] = useKvState<boolean>({
    key: MUTED_ROW_KEY,
    default: false,
    codec: MUTED_CODEC,
  });
  const toggleMuted = useCallback(() => {
    setMuted((m) => !m);
  }, [setMuted]);

  const screenAudible = useScreenAudible();
  const ttsEnabled =
    screenAudible && !muted && !bubbleResolving && message.trim().length > 0;

  const { isLoading, isSpeaking } = useSpeak({
    text: message,
    enabled: ttsEnabled,
  });

  const indicatorState = resolveIndicatorState(muted, isSpeaking);

  return (
    <Box
      {...componentDataSet('SpeakingAvatar', dataSet)}
      sx={{ flexDirection: 'row', alignItems: 'center', px: 4, gap: 1 }}
      style={style}
    >
      <Pressable
        onPress={toggleMuted}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Unmute coach' : 'Mute coach'}
        feedback="none"
        style={{ position: 'relative' }}
      >
        <SvgXml xml={svg} />
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            bottom: 0,
          }}
        >
          <SoundIndicator
            state={indicatorState}
            size={14}
            backgroundColor={theme.colors.surfaceElevated}
            color={theme.colors.text}
            mutedColor={theme.colors.textSecondary}
          />
        </Box>
      </Pressable>
      <SpeechBubble
        text={message}
        loading={isLoading || bubbleResolving}
        {...(header !== undefined ? { header } : {})}
        {...(numberOfLines !== undefined ? { numberOfLines } : {})}
      />
    </Box>
  );
}
