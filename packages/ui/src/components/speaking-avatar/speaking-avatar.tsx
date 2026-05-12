/**
 * `SpeakingAvatar` -- a DiceBear "person" avatar paired with a speech
 * bubble that types out a message one character at a time, and speaks the
 * message aloud via the TTS module.
 *
 * Purely presentational for the visual layer: the message comes in via
 * props, callers resolve any i18n to a plain string before passing it in
 * (the typewriter walks `string.charAt`, which can't operate on JSX).
 *
 * Audio always runs through `<TtsProvider>` — there is no anonymous /
 * optional fallback. Callers MUST mount this component beneath a
 * `<TtsProvider>` (storybook previews and tests do the same in their own
 * harness) and MUST pass an explicit `voice`. Pass `speak={false}` to
 * mute audio (the typewriter still runs).
 *
 * @example
 * ```tsx
 * <SpeakingAvatar message="Your move" voice={Voices.David} />
 * <SpeakingAvatar message={t`Solved`} voice={Voices.Sam} avatarSize={48} />
 * <SpeakingAvatar message="silent" voice={Voices.David} speak={false} />
 * ```
 */

import { useTts } from '@gamezilla/tts/client/tts-context';
import type { Voice } from '@gamezilla/tts/shared/tts-voice';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Avatar } from '../avatar';
import { speakingAvatarSvg } from './speaking-avatar-svg';
import { SpeechBubble } from './speech-bubble';
import { useTypewriter } from './use-typewriter';

const DEFAULT_AVATAR_SIZE = 64;
const DEFAULT_CHAR_DELAY_MS = 30;
const DEFAULT_SEED = '01J9H25D949E4A51ZV2N3676V1';
const ROW_GAP = 12;

export type SpeakingAvatarProps = {
  message: string;
  /** Voice to speak with. Pin one of the `Voices.*` constants per call site. */
  voice: Voice;
  /** Diameter of the DiceBear avatar in pixels. Defaults to `64`. */
  avatarSize?: number;
  /** Milliseconds between typed characters. Defaults to `30`. */
  charDelayMs?: number;
  /** DiceBear seed (controls which face is generated). Defaults to `'speaking-avatar'`. */
  seed?: string;
  /**
   * When `true` (default), speaks the message aloud. Set to `false` for
   * muted/decorative usage; the typewriter still runs.
   */
  speak?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SpeakingAvatar({
  message,
  voice,
  avatarSize = DEFAULT_AVATAR_SIZE,
  charDelayMs = DEFAULT_CHAR_DELAY_MS,
  seed = DEFAULT_SEED,
  speak = true,
  style,
}: SpeakingAvatarProps): ReactNode {
  const svg = useMemo(
    () => speakingAvatarSvg(seed, avatarSize),
    [seed, avatarSize]
  );
  const shown = useTypewriter(message, charDelayMs);
  const stillTyping = shown.length < message.length;

  const tts = useTts();
  /**
   * Held in a ref so the playback effect can read the latest `tts` without
   * listing it as a dependency. `TtsProvider`'s context value re-memoizes
   * whenever `player.isPlaying` or `player.currentUrl` changes — i.e. every
   * time _our own_ audio starts or stops — and listing `tts` here would make
   * the effect interrupt itself in a loop.
   */
  const ttsRef = useRef(tts);
  ttsRef.current = tts;
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const lastSpokenRef = useRef<string | null>(null);

  /**
   * Kick off TTS when the message text changes — the audio fetch happens in
   * parallel with the typewriter reveal so they finish around the same time
   * on cache hits.
   *
   * `lastSpokenRef` dedupes against React re-renders so each distinct
   * message is spoken exactly once. It also keeps the cleanup function from
   * being registered when we early-return — that's what makes the next
   * pass's abort logic safe: cleanups only run for utterances we actually
   * started.
   *
   * Overlap prevention: each kept-utterance captures its own
   * `AbortController` and `t` in the cleanup closure. When the effect
   * re-runs we
   *   1. `controller.abort()` — cancels the prior message's in-flight
   *      `synthesize` fetch so its resolved `player.play(url)` cannot fire
   *      after we've moved on, and
   *   2. `t.stop()` — pauses any audio currently playing from a prior
   *      message.
   * The two together make it impossible for a previous utterance to
   * overlap with the new one, even when messages change faster than the
   * synthesize fetch can resolve.
   */
  useEffect(() => {
    const t = ttsRef.current;
    const v = voiceRef.current;
    if (!speak) return;
    if (message.trim().length === 0) return;
    if (lastSpokenRef.current === message) return;
    lastSpokenRef.current = message;

    const controller = new AbortController();
    void t
      .play(message, { voice: v, format: 'mp3', signal: controller.signal })
      .catch(() => {});

    return () => {
      controller.abort();
      t.stop();
    };
  }, [message, speak]);

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
      <Avatar size={avatarSize} background="surface" svg={svg} />
      <SpeechBubble text={shown} caret={stillTyping ? '\u2588' : ''} />
    </View>
  );
}
