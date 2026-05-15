import { createContext, useContext, type ReactNode } from 'react';

import type { AssistantSpeechResolver } from '../shared/speech-resolver';

const AssistantSpeechResolverReactContext =
  createContext<AssistantSpeechResolver | null>(null);

export type AssistantSpeechResolverProviderProps = {
  readonly resolver: AssistantSpeechResolver;
  readonly children: ReactNode;
};

export function AssistantSpeechResolverProvider(
  props: AssistantSpeechResolverProviderProps
): React.ReactElement {
  return (
    <AssistantSpeechResolverReactContext.Provider value={props.resolver}>
      {props.children}
    </AssistantSpeechResolverReactContext.Provider>
  );
}

export function useAssistantSpeechResolver(): AssistantSpeechResolver {
  const v = useContext(AssistantSpeechResolverReactContext);
  if (v === null) {
    throw new Error(
      'useAssistantSpeechResolver must be used within AssistantSpeechResolverProvider'
    );
  }
  return v;
}
