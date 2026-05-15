import {
  isLlmProviderError,
  type LlmProvider,
} from '@gamezilla/llm/shared/llm-provider';
import { LLM_PROVIDER_OPENAI } from '@gamezilla/llm/shared/llm-types';

import type {
  AssistantSpeechHistoryLine,
  AssistantSpeechLlmContext,
  AssistantSpeechRequest,
  AssistantSpeechResolver,
} from './speech-resolver';

const DEFAULT_SCHEMA_VERSION = 'assistant.speech.v10';
const DEFAULT_MODEL = 'gpt-4o-mini';

/** OpenAI chat allows 0–2; use 0 for structured outputs compatibility. */
const DEFAULT_SPEECH_TEMPERATURE = 0;

/** Default character cap. Games can override per request via llm.maxChars. */
const DEFAULT_MESSAGE_MAX_LENGTH = 56;

/** Hard upper bound so a runaway override can't blow up TTS budgets. */
const MESSAGE_HARD_MAX_LENGTH = 240;

/**
 * Universally true: assistant lines are spoken short blurbs. Everything else
 * (second-person vs third-person, coach vs taunt vs commentator, praise rules,
 * emojis on/off) is up to the game's injected context.
 */
const UNIVERSAL_STYLE =
  'Output a single short phrase meant to be spoken aloud. ' +
  'Plain text only: no markdown, bullet lists, numbered lists, code blocks, block quotes, or headings. ' +
  'One sentence at most. Stay within maxChars characters.';

const ASSISTANT_SPEECH_JSON_SCHEMA = (
  maxLen: number
): Readonly<Record<string, unknown>> => ({
  type: 'object',
  properties: {
    message: { type: 'string', maxLength: maxLen },
  },
  required: ['message'],
  additionalProperties: false,
});

function resolveMaxChars(ctx: AssistantSpeechLlmContext | undefined): number {
  const requested = ctx?.maxChars;
  if (typeof requested !== 'number' || !Number.isFinite(requested)) {
    return DEFAULT_MESSAGE_MAX_LENGTH;
  }
  const rounded = Math.floor(requested);
  if (rounded < 1) {
    return DEFAULT_MESSAGE_MAX_LENGTH;
  }
  return Math.min(rounded, MESSAGE_HARD_MAX_LENGTH);
}

function joinPromptSegments(
  parts: readonly (string | null | undefined)[]
): string {
  return parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter((p) => p.length > 0)
    .join(' ');
}

function defaultIdentifiers(request: AssistantSpeechRequest): string {
  return `intent=${request.intent}, signalTags=${request.tags.join(',') || 'none'}, payloadRef=${request.payloadRef}, locale=${request.locale}.`;
}

function renderHistoryBlock(
  lines: readonly AssistantSpeechHistoryLine[]
): string {
  if (lines.length === 0) {
    return '';
  }
  const items = lines
    .slice(-6)
    .map((l) => `- "${l.text.replace(/"/g, "'")}"`)
    .join('\n');
  return (
    'Recent assistant lines (most recent last; do NOT repeat their phrasing, openers, or sentence shape):\n' +
    items
  );
}

function llmRulesJoined(
  llm: AssistantSpeechLlmContext | undefined
): string | undefined {
  const r = llm?.rules;
  if (r === undefined || r.length === 0) {
    return undefined;
  }
  return r.join(' ');
}

function identifiersForRequest(request: AssistantSpeechRequest): string {
  return request.llm?.identifiers ?? defaultIdentifiers(request);
}

function historyInstructionSegment(
  llm: AssistantSpeechLlmContext | undefined
): string | undefined {
  const lines = llm?.history?.recentLines ?? [];
  const block = renderHistoryBlock(lines);
  return block.length > 0 ? block : undefined;
}

function buildInstruction(
  request: AssistantSpeechRequest,
  maxLen: number
): string {
  const llm = request.llm;
  return joinPromptSegments([
    UNIVERSAL_STYLE.replace('maxChars', String(maxLen)),
    llm?.persona,
    llm?.grounding,
    llm?.tone,
    llmRulesJoined(llm),
    historyInstructionSegment(llm),
    `Identifiers: ${identifiersForRequest(request)}`,
  ]);
}

function clipToConcisePhrase(raw: string, maxLen: number): string {
  const collapsed = raw.trim().replace(/\s+/g, ' ');
  const oneLine = (collapsed.split('\n')[0] ?? collapsed).trim();
  const sentenceMatch = /^(.{1,}?[.!?])(\s|$)/u.exec(oneLine);
  const firstSentence = sentenceMatch ? sentenceMatch[1]!.trim() : oneLine;
  if (firstSentence.length <= maxLen) {
    return firstSentence;
  }
  const slice = firstSentence.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  const clipped =
    lastSpace > Math.floor(maxLen * 0.45) ? slice.slice(0, lastSpace) : slice;
  return clipped.trim();
}

function buildStructuredInput(
  request: AssistantSpeechRequest,
  instruction: string,
  maxLen: number
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    intent: request.intent,
    payloadRef: request.payloadRef,
    tags: request.tags,
    locale: request.locale,
    instruction,
    maxChars: maxLen,
  };
  const llm = request.llm;
  if (llm === undefined) {
    return base;
  }
  if (llm.persona !== undefined) base['llmPersona'] = llm.persona;
  if (llm.grounding !== undefined) base['llmGrounding'] = llm.grounding;
  if (llm.tone !== undefined) base['llmTone'] = llm.tone;
  if (llm.identifiers !== undefined) base['llmIdentifiers'] = llm.identifiers;
  if (llm.rules !== undefined) base['llmRules'] = llm.rules;
  const hist = llm.history?.recentLines;
  if (hist !== undefined && hist.length > 0) {
    base['llmHistoryLines'] = hist.map((l) => ({
      payloadRef: l.payloadRef,
      intent: l.intent,
      tags: [...l.tags],
      text: l.text,
      ...(l.ageMs !== undefined ? { ageMs: l.ageMs } : {}),
    }));
  }
  return base;
}

export type CreateLlmAssistantSpeechResolverOptions = {
  readonly schemaVersion?: string;
  readonly model?: string;
  /** OpenAI structured chat: 0–2. Default is 0 (reliable with json_schema). */
  readonly temperature?: number;
};

/**
 * Maps {@link AssistantSpeechRequest} to {@link LlmProvider.structured}.
 * The only module in `@gamezilla/assistant` that imports `@gamezilla/llm`.
 *
 * The resolver itself stays opinionated about only one thing: the response is
 * a short, plain-text, spoken-style line. All other prompt content — persona,
 * tone, grounding, identifiers, ad-hoc rules — comes from the game via
 * {@link AssistantSpeechLlmContext}, so the same resolver fits puzzle coaches,
 * vs-bot banter, post-game review, sportscaster commentary, taunts, etc.
 */
export function createLlmAssistantSpeechResolver(
  llm: LlmProvider,
  options?: CreateLlmAssistantSpeechResolverOptions
): AssistantSpeechResolver {
  const schemaVersion = options?.schemaVersion ?? DEFAULT_SCHEMA_VERSION;
  const model = options?.model ?? DEFAULT_MODEL;
  const temperature = options?.temperature ?? DEFAULT_SPEECH_TEMPERATURE;

  return {
    id: `llm:${llm.id}`,
    async resolve(
      request: AssistantSpeechRequest,
      signal: AbortSignal
    ): Promise<string | null> {
      if (signal.aborted) {
        return null;
      }
      const maxLen = resolveMaxChars(request.llm);
      const instruction = buildInstruction(request, maxLen);
      const input = buildStructuredInput(request, instruction, maxLen);

      try {
        const { json } = await llm.structured({
          input,
          schema: ASSISTANT_SPEECH_JSON_SCHEMA(maxLen),
          model,
          provider: LLM_PROVIDER_OPENAI,
          schemaVersion,
          temperature,
        });
        if (signal.aborted) {
          return null;
        }
        const raw = json['message'];
        if (typeof raw !== 'string') {
          return null;
        }
        const clipped = clipToConcisePhrase(raw, maxLen);
        return clipped.length > 0 ? clipped : null;
      } catch (err: unknown) {
        if (signal.aborted) {
          return null;
        }
        if (isLlmProviderError(err)) {
          return null;
        }
        throw err;
      }
    },
  };
}
