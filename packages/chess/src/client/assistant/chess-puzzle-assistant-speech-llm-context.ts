import type {
  AssistantSpeechHistoryLine,
  AssistantSpeechLlmContext,
} from '@gamezilla/assistant/shared';

import { parseChessPuzzleAssistantRef } from './chess-puzzle-assistant-ref';

const PERSONA =
  'You are a friendly chess coach helping one player solve a tactical puzzle. Address them in the second person.';

const GROUNDING =
  'Match lastMoveOutcome: never imply a correct move was wrong, or a wrong move was right. ' +
  'Name a tactic (fork, pin, skewer, exposed king, hanging piece, etc.) ONLY when themeId is that tactic; otherwise stay neutral (e.g. find the best move, what is next). ' +
  'puzzleCatalogThemes is informational — do not surface unrelated tags. ' +
  'Do not invent board facts beyond what themeId, moment, and intent imply.';

const COMPLETION_RULE =
  'Completion-style praise (Great job!, Well done!, Nailed it!, etc.) is only allowed when signal tags include solved.';

const VARIETY_RULE =
  'Phrasing variety: pick fresh wording each turn — vary openers, verbs, and structure. Avoid recycling the same template phrases.';

/**
 * Per-bucket tone. Kept to one short line each so the model has room to vary
 * phrasing; specifics (correct vs incorrect, etc.) come from `lastMoveOutcome`
 * in identifiers rather than long forbidden-word lists.
 */
function chessPuzzleTone(bucket: string): string {
  switch (bucket) {
    case 'start':
    case 'announce':
      return 'Tone: opening cue — invite them to look for the idea. Never sound like a redo.';
    case 'wrong':
    case 'retry':
      return 'Tone: their last move missed — brief redo nudge. Never treat the missed move as good.';
    case 'progress':
      return 'Tone: their last move was correct and the line continues — tiny ack or forward cue only. Never sound like a redo or a final celebration.';
    case 'solved':
      return 'Tone: the puzzle is finished — brief, warm closer. Never sound like a redo.';
    case 'fallback':
      return 'Tone: edge case — gently suggest moving on.';
    default:
      return 'Tone: follow lastMoveOutcome — success beats and miss beats must not blur.';
  }
}

function lastMoveOutcomeForBucket(bucket: string): string {
  switch (bucket) {
    case 'progress':
      return 'correct_partial';
    case 'wrong':
      return 'incorrect';
    case 'retry':
      return 'incorrect_retry';
    case 'solved':
      return 'correct_complete';
    case 'start':
    case 'announce':
      return 'none_opening';
    case 'fallback':
      return 'unknown_neutral';
    default:
      return 'unknown';
  }
}

export function buildChessPuzzleSpeechLlmContext(args: {
  readonly payloadRef: string;
  readonly catalogThemes: readonly string[];
  readonly recentLines?: readonly AssistantSpeechHistoryLine[];
}): AssistantSpeechLlmContext | undefined {
  const parsed = parseChessPuzzleAssistantRef(args.payloadRef);
  if (parsed === null) {
    return undefined;
  }
  const catalogStr =
    args.catalogThemes.length > 0 ? args.catalogThemes.join('|') : 'none';
  const outcome = lastMoveOutcomeForBucket(parsed.bucket);
  const recent = args.recentLines;
  return {
    persona: PERSONA,
    grounding: GROUNDING,
    tone: chessPuzzleTone(parsed.bucket),
    rules: [COMPLETION_RULE, VARIETY_RULE],
    ...(recent !== undefined && recent.length > 0
      ? { history: { recentLines: recent } }
      : {}),
    identifiers: `moment=${parsed.bucket}, lastMoveOutcome=${outcome}, themeId=${parsed.theme}, lineVariant=${parsed.variation}, puzzleCatalogThemes=${catalogStr}, payloadRef=${args.payloadRef}.`,
  };
}
