import { SpeakingAvatar, type SpeakingAvatarProps } from '@gamezilla/ui';
import { useEffect, useState, type ReactNode } from 'react';

import type { Assistant } from '../../shared/index';
import { subscribeAssistantSpeaking } from './assistant-speaking-bridge';

export type SpeakingAvatarAssistantProps<TPayload = unknown> = {
  readonly assistant: Assistant<TPayload>;
} & Omit<SpeakingAvatarProps, 'message'>;

/**
 * {@link SpeakingAvatar} whose `message` is driven by the paired
 * {@link Assistant} renderer via {@link emitAssistantSpeakingMessage}.
 */
export function SpeakingAvatarAssistant<TPayload = unknown>({
  assistant,
  ...avatarProps
}: SpeakingAvatarAssistantProps<TPayload>): ReactNode {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    return subscribeAssistantSpeaking(assistant, setMessage);
  }, [assistant]);

  return <SpeakingAvatar message={message ?? ''} {...avatarProps} />;
}
