import {
  createRuntime,
  DEFAULT_ADMIN_KEY,
  DEFAULT_TOKEN,
  type OpenAIRuntimeOptions,
} from '@crvouga/mockingbird-service-openai';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import { OpenAiLlmProvider } from '@pkgs/llm-openai-shared-ts/openai-llm-provider';
import type { HarnessEmulator } from './emulators';
import { mockingbirdClock } from './mockingbird-clock';

const OPENAI_ORIGIN = 'http://openai.mock';

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
    /** The emulator itself, for an operator looking into it. */
    emulator: {
      id: 'openai',
      title: 'Language model (OpenAI)',
      origin: OPENAI_ORIGIN,
      // The operator is the administrator: this emulator asks for its key.
      fetch: (input, init) => {
        const request = new Request(input, init);
        request.headers.set('x-mockingbird-admin-key', DEFAULT_ADMIN_KEY);
        return runtime.fetch(request);
      },
    } satisfies HarnessEmulator,
    provider: new OpenAiLlmProvider({
      apiKey: DEFAULT_TOKEN,
      baseUrl: OPENAI_ORIGIN,
      http: { fetch: (input, init) => runtime.fetch(new Request(input, init)) },
    }),
  };
}
