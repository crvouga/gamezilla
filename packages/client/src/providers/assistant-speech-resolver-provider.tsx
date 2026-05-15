import { AssistantSpeechResolverProvider } from '@gamezilla/assistant/client';
import { createLlmAssistantSpeechResolver } from '@gamezilla/assistant/shared/speech-resolver-llm';
import { useLlm } from '@gamezilla/llm/client/use-llm';
import { useMemo, type ReactNode } from 'react';

/**
 * Bridges {@link useLlm} into {@link AssistantSpeechResolverProvider}.
 * Must render inside {@link LlmProviderWrapper}.
 */
export function AssistantSpeechResolverProviderWrapper({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const llm = useLlm();
  const resolver = useMemo(() => createLlmAssistantSpeechResolver(llm), [llm]);
  return (
    <AssistantSpeechResolverProvider resolver={resolver}>
      {children}
    </AssistantSpeechResolverProvider>
  );
}
