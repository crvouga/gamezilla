/** @jsxImportSource @solidjs/web */

import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import { createKvState } from '@pkgs/kv-root-client-ts/solid';
import { booleanKvCodec } from '@pkgs/kv-root-shared-ts/kv-state-codec';
import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { speakingAvatarSvg } from '@pkgs/ui-root-shared-ts/speaking-avatar-svg';
import { svgToDataUri } from '@pkgs/ui-root-shared-ts/svg-data-uri';
import type { JSX } from '@solidjs/web';
import { Button as SdkButton } from '@ui-sdk/solid/button';
import { type Accessor, createMemo, omit, Show, untrack } from 'solid-js';
import type { SoundIndicatorState } from '../sound-indicator/index';
import { SoundIndicator } from '../sound-indicator/index';
import { SpeechBubble } from '../speech-bubble/index';
import styles from './speaking-avatar.module.css';

const MUTED_ROW_KEY = asKeyword('ui/speaking-avatar-muted');
const MUTED_VALUE_ATTR = asKeyword('ui/value');
const MUTED_CODEC = booleanKvCodec(MUTED_VALUE_ATTR);

const DEFAULT_AVATAR_SIZE = 96;
const DEFAULT_SEED = 'speaking-avatar';

/** Reactive input handed to the injected speaker. */
export type SpeakingAvatarSpeechArgs = {
  readonly text: string;
  readonly contextKey?: string | undefined;
  /** `false` while muted, resolving, or when `text` is blank. */
  readonly enabled: boolean;
};

/** Playback signals the speaker exposes (a subset of `@pkgs/tts` `SpeakResult`). */
export type SpeakingAvatarSpeech = {
  readonly isLoading: Accessor<boolean>;
  readonly isSpeaking: Accessor<boolean>;
};

/** Structurally `createSpeak` from `@pkgs/tts/solid`; called once at mount. */
export type SpeakingAvatarSpeaker = (
  args: Accessor<SpeakingAvatarSpeechArgs>
) => SpeakingAvatarSpeech;

export type SpeakingAvatarProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  'children' | 'class' | 'style'
> & {
  message: string;
  /** Cancels old speech when the described position changes, even for identical text. */
  contextKey?: string | undefined;
  /** Rendered above the bubble text (see `SpeechBubble`). */
  header?: JSX.Element | undefined;
  /**
   * When true, the speech bubble shows the typing indicator (e.g. while an
   * LLM-backed coach line is loading). TTS stays off until this is false and
   * `message` is non-empty.
   */
  bubbleResolving?: boolean | undefined;
  /** Injected TTS binding (see module docs). Read once at mount. */
  speaker?: SpeakingAvatarSpeaker | undefined;
  /** Size of the DiceBear head graphic in pixels (width === height). Defaults to `96`. */
  avatarSize?: number | undefined;
  /** DiceBear seed (controls which face is generated). Defaults to `'speaking-avatar'`. */
  seed?: string | undefined;
  /**
   * When `true` (default), audio playback is permitted (given a `speaker`).
   * When `false`, audio is permanently off and the mute toggle / indicator
   * are hidden. Read once at mount.
   */
  speak?: boolean | undefined;
  /** Lines reserved inside the speech bubble. Defaults to `2`. */
  numberOfLines?: number | undefined;
  /** The bubble keeps exactly `numberOfLines` of height (`SpeechBubble`). */
  fixedHeight?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const SILENT: SpeakingAvatarSpeech = {
  isLoading: () => false,
  isSpeaking: () => false,
};

function resolveIndicatorState(
  muted: boolean,
  isSpeaking: boolean
): SoundIndicatorState {
  if (muted) return 'muted';
  if (isSpeaking) return 'playing';
  return 'idle';
}

function HeadImage(props: { svg: string; size: number }): JSX.Element {
  return (
    <img
      class={styles['head']}
      src={svgToDataUri(props.svg)}
      alt=""
      width={props.size}
      height={props.size}
      draggable="false"
    />
  );
}

function AvatarHead(props: {
  svg: string;
  size: number;
  muted: boolean;
  indicator: SoundIndicatorState;
  onToggle: () => void;
  testId: string | undefined;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <SdkButton
      class="clickable relative self-center"
      type="button"
      onClick={() => props.onToggle()}
      aria-pressed={props.muted ? 'true' : 'false'}
      aria-label={props.muted ? t`Unmute coach` : t`Mute coach`}
      data-testid={props.testId}
    >
      <HeadImage svg={props.svg} size={props.size} />
      <div class="box absolute right-0 bottom-0">
        <SoundIndicator
          state={props.indicator}
          size={14}
          backgroundColor="surfaceElevated"
          color="text"
          mutedColor="textSecondary"
        />
      </div>
    </SdkButton>
  );
}

/**
 * `SpeakingAvatar` -- a DiceBear "fun-emoji" character rendered raw (no
 * circular crop), paired with a speech bubble that slides+fades in whenever
 * the message changes, in sync with TTS playback.
 *
 * Purely presentational: the message comes in as a plain string. Callers
 * resolve any i18n upstream before passing it in.
 *
 * Audio is injected: pass `speaker` -- structurally `createSpeak` from
 * `@pkgs/tts/solid` (bind a voice in a closure:
 * `speaker={(args) => createSpeak(() => ({ ...args(), voice: Voices.David }))}`).
 * Without a `speaker`, or with `speak={false}`, audio is permanently off and
 * the in-component mute toggle / indicator are hidden.
 *
 * Mute affordance: when audio is possible, clicking the avatar head toggles a
 * `muted` flag persisted via `createKvState` (survives reloads when an ambient
 * `<KvProvider>` is mounted; in-memory otherwise). A `SoundIndicator` in the
 * bottom-right of the head shows `'idle'` / `'playing'` / `'muted'`.
 *
 * @example
 * ```tsx
 * <SpeakingAvatar message="Your move" speaker={createSpeak} />
 * <SpeakingAvatar message="silent" />
 * ```
 */
export function SpeakingAvatar(props: SpeakingAvatarProps): JSX.Element {
  const rest = omit(
    props,
    'message',
    'contextKey',
    'header',
    'bubbleResolving',
    'speaker',
    'avatarSize',
    'seed',
    'speak',
    'numberOfLines',
    'fixedHeight',
    'dataSet'
  );
  // Audio wiring is composition-level configuration: read once.
  // Named `create*` so the injected primitive is treated as a tracked scope.
  const createSpeech = untrack(() =>
    props.speak === false ? undefined : props.speaker
  );
  const size = () => props.avatarSize ?? DEFAULT_AVATAR_SIZE;
  const svg = createMemo(() =>
    speakingAvatarSvg(props.seed ?? DEFAULT_SEED, size())
  );

  const [muted, setMuted] = createKvState<boolean>({
    key: MUTED_ROW_KEY,
    default: false,
    codec: MUTED_CODEC,
  });
  const speechArgs = createMemo<SpeakingAvatarSpeechArgs>(() => ({
    text: props.message,
    contextKey: props.contextKey,
    enabled:
      !muted() &&
      props.bubbleResolving !== true &&
      props.message.trim().length > 0,
  }));
  const speech = createSpeech === undefined ? SILENT : createSpeech(speechArgs);
  const indicator = () => resolveIndicatorState(muted(), speech.isSpeaking());

  return (
    <div
      class="box flex-row items-center px-4 gap-1 min-w-0"
      {...rest}
      data-muted={String(muted())}
      data-speaking={String(speech.isSpeaking())}
      data-loading={String(speech.isLoading())}
      {...dataAttrs({ component: 'SpeakingAvatar', ...props.dataSet })}
    >
      <Show
        when={createSpeech !== undefined}
        fallback={
          <div class="box self-center">
            <HeadImage svg={svg()} size={size()} />
          </div>
        }
      >
        <AvatarHead
          svg={svg()}
          size={size()}
          muted={muted()}
          indicator={indicator()}
          onToggle={() => setMuted((m) => !m)}
          testId={
            props.dataSet?.['testid'] === undefined
              ? undefined
              : `${props.dataSet['testid']}-mute`
          }
        />
      </Show>
      <SpeechBubble
        text={props.message}
        loading={speech.isLoading() || props.bubbleResolving === true}
        header={props.header}
        numberOfLines={props.numberOfLines}
        fixedHeight={props.fixedHeight}
      />
    </div>
  );
}
