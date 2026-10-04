import type { LlmProvider } from '@pkgs/llm-root-shared/llm-provider';
import { LlmProviderError } from '@pkgs/llm-root-shared/llm-provider';
import type {
  LlmStructuredRequest,
  LlmStructuredResult,
} from '@pkgs/llm-root-shared/llm-types';

export type InMemoryLlmProviderOptions = {
  readonly id?: string;
  /**
   * Optional scripted responses keyed by a stable fingerprint of the request
   * (`model` + `schemaVersion` + JSON.stringify(input)).
   */
  readonly responses?: ReadonlyMap<string, LlmStructuredResult>;
  /** Default JSON returned when no scripted response matches. */
  readonly defaultJson?: Readonly<Record<string, unknown>>;
};

/**
 * Test / harness {@link LlmProvider}. Deterministic structured results with knobs
 * for scripted replies and one-shot failures.
 */
export class InMemoryLlmProvider implements LlmProvider {
  readonly id: string;
  callCount = 0;
  lastRequest: LlmStructuredRequest | null = null;
  private failNextError: Error | null = null;
  private readonly responses: Map<string, LlmStructuredResult>;
  private readonly defaultJson: Readonly<Record<string, unknown>>;

  constructor(options: InMemoryLlmProviderOptions = {}) {
    this.id = options.id ?? 'in-memory';
    this.responses = new Map(options.responses ?? []);
    this.defaultJson = options.defaultJson ?? { ok: true };
  }

  /** Arm a one-shot failure for the next {@link structured} call. */
  failNext(
    error: Error = new LlmProviderError('in-memory fail', this.id)
  ): void {
    this.failNextError = error;
  }

  /** Register or replace a scripted response for a fingerprint. */
  setResponse(fingerprint: string, result: LlmStructuredResult): void {
    this.responses.set(fingerprint, result);
  }

  static fingerprint(request: LlmStructuredRequest): string {
    return `${request.model}|${request.schemaVersion}|${JSON.stringify(request.input)}`;
  }

  async structured(input: LlmStructuredRequest): Promise<LlmStructuredResult> {
    this.callCount += 1;
    this.lastRequest = input;
    if (this.failNextError !== null) {
      const err = this.failNextError;
      this.failNextError = null;
      throw err;
    }
    const key = InMemoryLlmProvider.fingerprint(input);
    const scripted = this.responses.get(key);
    if (scripted !== undefined) return scripted;
    return { json: this.defaultJson };
  }
}
