import {
  isLlmProviderError,
  type LlmProvider,
} from '@gamezilla/llm/shared/llm-provider';
import { LLM_PROVIDER_OPENAI } from '@gamezilla/llm/shared/llm-types';

import type {
  AssistantSpeechRequest,
  AssistantSpeechResolver,
} from './speech-resolver';

const DEFAULT_SCHEMA_VERSION = 'assistant.speech.v7';
const DEFAULT_MODEL = 'gpt-4o-mini';

/** OpenAI chat allows 0–2; use 0 for structured outputs compatibility. */
const DEFAULT_SPEECH_TEMPERATURE = 0;

/** Hard cap on characters — enforces “few words / one short sentence”. */
const MESSAGE_MAX_LENGTH = 56;

const ASSISTANT_SPEECH_JSON_SCHEMA: Readonly<Record<string, unknown>> = {
  type: 'object',
  properties: {
    message: { type: 'string', maxLength: MESSAGE_MAX_LENGTH },
  },
  required: ['message'],
  additionalProperties: false,
};

const STYLE_RULES =
  'One very short phrase to read aloud: prefer 2–6 words, at most one brief sentence. ' +
  'No lists, quotes, emojis, filler, or role-play. ' +
  'Always speak TO the player with an imperative or a soft command/question (Find…, Look for…, Try…, Spot…, or a short what-next question). ' +
  'Never output a flat position label or passive evaluation (forbidden examples: "Best move.", "Best move for a strong position.", "A winning line.", "Strong position.").';

const COMPLETION_PRAISE_RULE =
  'Completion praise: "Great job!", "Well done!", "Excellent!", "Perfect!", "You got it!", "Nailed it!", and similar "we finished the puzzle" cheers are ONLY allowed when moment=solved. ' +
  'For start, progress, wrong, retry, announce, or fallback, never use that completion-style praise—use coaching imperatives, redo cues, or for mid-solve correct moves a very short acknowledgment (That’s correct, Right, Good)—not motivational speeches about progress. ' +
  'Do not follow an intent label alone: if moment is not solved, never output completion cheers even when intent sounds celebratory.';

/**
 * Keeps lines from inventing tactics the puzzle line was not scoped to.
 * `themeId` comes from deterministic ref keys (e.g. fork vs opening).
 */
const GROUNDING_RULES =
  'Grounding: only say what these identifiers license. ' +
  'Name a concrete tactic (fork, pin, skewer, weak/exposed king, hanging piece, etc.) ONLY when themeId names that idea (e.g. themeId=fork → fork language is OK). ' +
  'If themeId is broad (opening, middlegame, endgame, crushing, advantage, equality, short, long, veryLong, oneMove, mate, mateIn1–mateIn5, master, quietMove, defensiveMove, zugzwang, pawnEndgame, rookEndgame, …): do NOT claim a specific tactic or piece vulnerability—use neutral imperative coaching (Find the best move, Look again, What’s next?), never a bare noun phrase about the position. ' +
  'puzzleCatalogThemes lists database tags for the puzzle (often many). Never mention a catalog tag in prose unless themeId already names that same idea—ignore unrelated catalog tags. ' +
  'Never invent board facts (which piece, checks, material) beyond what themeId + moment + intent imply.';

function readMetaString(
  meta: Readonly<Record<string, unknown>>,
  key: string
): string {
  const v = meta[key];
  return typeof v === 'string' ? v : '';
}

function readMetaVariation(
  meta: Readonly<Record<string, unknown>>
): number | undefined {
  const v = meta['variation'];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function readMetaStringArray(
  meta: Readonly<Record<string, unknown>>,
  key: string
): readonly string[] {
  const v = meta[key];
  if (!Array.isArray(v)) {
    return [];
  }
  return v.filter((x): x is string => typeof x === 'string');
}

function voiceForMoment(bucket: string): string {
  switch (bucket) {
    case 'start':
    case 'announce':
      return 'Moment voice: opening the puzzle—sound like a coach cue: tell them what to look for or do next (e.g. find / look / spot / try), not a verdict on the position. No completion praise.';
    case 'wrong':
    case 'retry':
      return 'Moment voice: after a miss—short redo cue (look again, try again), imperative only. No completion praise.';
    case 'progress':
      return (
        'Moment voice: mid-solve after a correct move—keep it minimal: short correctness acks (That’s correct, That’s right, Good, Yes) or a tiny next-step cue (What’s next?, Find the next). ' +
        'Do not use motivational progress lines (forbidden examples: "Keep going, you’re making progress!", "You’re doing great, keep it up!", similar). No completion praise.'
      );
    case 'solved':
      return 'Moment voice: puzzle just finished—brief celebratory praise is OK here (Great job!, Nice!, Well done!).';
    case 'fallback':
      return 'Moment voice: error/edge—clear next-step imperative (try another, skip ahead). No completion praise.';
    default:
      return 'Moment voice: prefer imperative coaching over declarative statements. No completion praise unless moment=solved.';
  }
}

function buildInstruction(request: AssistantSpeechRequest): string {
  const bucket = readMetaString(request.meta, 'bucket');
  const theme = readMetaString(request.meta, 'theme');
  const variation = readMetaVariation(request.meta);
  const tags = request.tags.join(',');
  const catalog = readMetaStringArray(request.meta, 'puzzleCatalogThemes');
  const catalogStr = catalog.length > 0 ? catalog.join('|') : 'none';
  const ids = `Identifiers: moment=${bucket || 'unknown'}, themeId=${theme || 'unknown'}, lineVariant=${variation ?? 'n/a'}, intent=${request.intent}, signalTags=${tags || 'none'}, puzzleCatalogThemes=${catalogStr}, payloadRef=${request.payloadRef}.`;
  return `${STYLE_RULES} ${COMPLETION_PRAISE_RULE} ${GROUNDING_RULES} ${voiceForMoment(bucket)} ${ids}`;
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

export type CreateLlmAssistantSpeechResolverOptions = {
  readonly schemaVersion?: string;
  readonly model?: string;
  /** OpenAI structured chat: 0–2. Default is 0 (reliable with json_schema). */
  readonly temperature?: number;
};

/**
 * Maps {@link AssistantSpeechRequest} to {@link LlmProvider.structured}.
 * The only module in `@gamezilla/assistant` that imports `@gamezilla/llm`.
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
      const input: Record<string, unknown> = {
        intent: request.intent,
        payloadRef: request.payloadRef,
        tags: request.tags,
        locale: request.locale,
        ...request.meta,
        instruction: buildInstruction(request),
        maxChars: MESSAGE_MAX_LENGTH,
      };

      try {
        const { json } = await llm.structured({
          input,
          schema: ASSISTANT_SPEECH_JSON_SCHEMA,
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
        const clipped = clipToConcisePhrase(raw, MESSAGE_MAX_LENGTH);
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
