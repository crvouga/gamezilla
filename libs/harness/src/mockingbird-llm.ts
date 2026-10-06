import {
  createRuntime,
  DEFAULT_TOKEN,
  type OpenAIRuntimeOptions,
} from '@crvouga/mockingbird-service-openai';
import type { Clock } from '@pkgs/clock-shared/types';
import { OpenAiLlmProvider } from '@pkgs/llm-openai-shared/openai-llm-provider';
import { mockingbirdClock } from './mockingbird-clock';

/** The production OpenAI client talks to Mockingbird's vendor protocol in process. */
export function createHarnessLlm(args: {
  readonly clock: Clock;
  readonly scripts?: OpenAIRuntimeOptions['scripts'];
  readonly models?: OpenAIRuntimeOptions['models'];
}) {
  const runtime = createRuntime({
    clock: mockingbirdClock(args.clock),
    ...(args.scripts === undefined ? {} : { scripts: args.scripts }),
    ...(args.models === undefined ? {} : { models: args.models }),
  });
  return {
    runtime,
    provider: new OpenAiLlmProvider({
      apiKey: DEFAULT_TOKEN,
      baseUrl: 'http://openai.mock',
      http: { fetch: (input, init) => runtime.fetch(new Request(input, init)) },
    }),
  };
}
