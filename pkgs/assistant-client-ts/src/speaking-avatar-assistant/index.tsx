import type { Assistant } from '@pkgs/assistant-shared-ts/engine';
import type { SpeakingAvatarProps } from '@pkgs/ui-root-client-ts/speaking-avatar';
import { SpeakingAvatar } from '@pkgs/ui-root-client-ts/speaking-avatar';
import type { JSX } from '@solidjs/web';
import { createEffect, createSignal, omit } from 'solid-js';
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
  const avatarProps = omit(props, 'assistant');
  // A line belongs to the assistant that spoke it: another assistant starts silent.
  const [message, setMessage] = createSignal(() => {
    props.assistant;
    return '';
  });
  const [bubbleResolving, setBubbleResolving] = createSignal(() => {
    props.assistant;
    return false;
  });

  createEffect(
    () => props.assistant,
    (assistant) =>
      subscribeAssistantSpeaking(assistant, (u) => {
        setMessage(u.message ?? '');
        setBubbleResolving(u.bubbleResolving ?? false);
      })
  );

  return (
    <SpeakingAvatar
      message={message()}
      bubbleResolving={bubbleResolving()}
      {...avatarProps}
    />
  );
}
