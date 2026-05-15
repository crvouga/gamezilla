import type { Intent } from './_internal/intents';

/** One resolved assistant line, for anti-repetition context. */
export type AssistantSpeechHistoryLine = {
  readonly payloadRef: string;
  readonly intent: Intent;
  readonly tags: readonly string[];
  readonly text: string;
  /** Milliseconds since this line was spoken (optional if unknown). */
  readonly ageMs?: number;
};

export type AssistantSpeechHistory = {
  readonly recentLines: readonly AssistantSpeechHistoryLine[];
};

/** Snapshot of recent spoken lines for {@link AssistantSpeechLlmContext.history}. */
export type AssistantSpeechLlmContextHelpers = {
  readonly recentLines: readonly AssistantSpeechHistoryLine[];
};

/**
 * Free-form, game-authored context the LLM resolver weaves into the prompt.
 * Every field is optional so this works for many shapes of assistant —
 * solo-puzzle coach, vs-bot opponent banter, post-game review, third-person
 * sportscaster, taunting opponent, etc. `@gamezilla/assistant` stays
 * domain-agnostic; the only thing it enforces is "short spoken line".
 */
export type AssistantSpeechLlmContext = {
  /** Who is speaking, to whom, and in what mode. Free-form. */
  readonly persona?: string;
  /** Truthfulness rules, allowed/forbidden references, glossary, etc. */
  readonly grounding?: string;
  /** Desired tone, register, length, and any beat-specific guidance. */
  readonly tone?: string;
  /** Canonical key=value identifiers the model may rely on. */
  readonly identifiers?: string;
  /** Additional ad-hoc rules / constraints. Joined into the prompt verbatim. */
  readonly rules?: readonly string[];
  /** Override the default character cap for this request. */
  readonly maxChars?: number;
  /** Recent spoken lines (e.g. from renderer); resolver folds into prompt + input. */
  readonly history?: AssistantSpeechHistory;
};

export type AssistantSpeechRequest = {
  readonly intent: Intent;
  readonly payloadRef: string;
  readonly tags: readonly string[];
  readonly locale: string;
  /** Optional engine metadata (not read by the default LLM resolver). */
  readonly meta: Readonly<Record<string, unknown>>;
  /** Game-supplied prompt context. Everything is optional. */
  readonly llm?: AssistantSpeechLlmContext;
};

export interface AssistantSpeechResolver {
  readonly id: string;
  resolve(
    request: AssistantSpeechRequest,
    signal: AbortSignal
  ): Promise<string | null>;
}
