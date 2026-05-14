import type { LlmProvider } from '../shared/llm-provider';

import { useLlmContext } from './llm-context';

/** The isomorphic {@link LlmProvider} from React context. */
export function useLlm(): LlmProvider {
  return useLlmContext();
}
