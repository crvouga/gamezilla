import type { Assistant } from '@pkgs/assistant-shared-ts/engine';
import type { SpeakingAvatarProps } from '@pkgs/ui-root-client-ts/speaking-avatar';
import { SpeakingAvatar } from '@pkgs/ui-root-client-ts/speaking-avatar';
import {
  batch,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
} from 'solid-js';
import { subscribeAssistantSpeaking } from '../assistant-speaking-bridge';

export type SpeakingAvatarAssistantProps<TPayload = unknown> = {
  readonly assistant: Assistant<TPayload>;
} & Omit<SpeakingAvatarProps, 'message' | 'bubbleResolving'>;
// `header` is forwarded via SpeakingAvatarProps spread below.

/**
 * {@link SpeakingAvatar} whose `message` is driven by the paired
 * {@link Assistant} renderer via {@link emitAssistantSpeakingMessage}.
 */
export function SpeakingAvatarAssistant<TPayload = unknown>(
  props: SpeakingAvatarAssistantProps<TPayload>
): JSX.Element {
  const [local, avatarProps] = splitProps(props, ['assistant']);
  const [message, setMessage] = createSignal('');
  const [bubbleResolving, setBubbleResolving] = createSignal(false);

  createEffect(() => {
    setMessage('');
    setBubbleResolving(false);
    onCleanup(
      subscribeAssistantSpeaking(local.assistant, (u) => {
        batch(() => {
          setMessage(u.message ?? '');
          setBubbleResolving(u.bubbleResolving ?? false);
        });
      })
    );
  });

  return (
    <SpeakingAvatar
      message={message()}
      bubbleResolving={bubbleResolving()}
      {...avatarProps}
    />
  );
}
