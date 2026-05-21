import { SpeakingAvatar, type SpeakingAvatarProps } from '@pkgs/ui';
import { useEffect, useState, type ReactNode } from 'react';

import type { Assistant } from '../../shared/index';
import { subscribeAssistantSpeaking } from './assistant-speaking-bridge';

export type SpeakingAvatarAssistantProps<TPayload = unknown> = {
  readonly assistant: Assistant<TPayload>;
} & Omit<SpeakingAvatarProps, 'message' | 'bubbleResolving'>;
// `header` is forwarded via SpeakingAvatarProps spread below.

/**
 * {@link SpeakingAvatar} whose `message` is driven by the paired
 * {@link Assistant} renderer via {@link emitAssistantSpeakingMessage}.
 */
export function SpeakingAvatarAssistant<TPayload = unknown>({
  assistant,
  ...avatarProps
}: SpeakingAvatarAssistantProps<TPayload>): ReactNode {
  const [message, setMessage] = useState('');
  const [bubbleResolving, setBubbleResolving] = useState(false);

  useEffect(() => {
    return subscribeAssistantSpeaking(assistant, (u) => {
      setMessage(u.message ?? '');
      setBubbleResolving(u.bubbleResolving ?? false);
    });
  }, [assistant]);

  return (
    <SpeakingAvatar
      message={message}
      bubbleResolving={bubbleResolving}
      {...avatarProps}
    />
  );
}
