import type { Assistant } from '../shared/index';
import type {
  AssistantAction,
  AssistantSpeakAction,
} from '../shared/_internal/action';
import type { AssistantRenderer } from '../shared/_internal/renderer';
import type {
  AssistantSpeechHistoryLine,
  AssistantSpeechLlmContext,
  AssistantSpeechLlmContextHelpers,
  AssistantSpeechRequest,
  AssistantSpeechResolver,
} from '../shared/speech-resolver';
import { emitAssistantSpeakingMessage } from './_internal/assistant-speaking-bridge';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_HISTORY_SIZE = 12;

const TIMEOUT_TOKEN = Symbol('timeout');

type HistoryBufferEntry = {
  readonly payloadRef: string;
  readonly intent: AssistantSpeakAction['intent'];
  readonly tags: readonly string[];
  readonly text: string;
  readonly completedAtMs: number;
};

function snapshotHistoryLines(
  buffer: readonly HistoryBufferEntry[]
): readonly AssistantSpeechHistoryLine[] {
  const now = Date.now();
  return buffer.map((e) => ({
    payloadRef: e.payloadRef,
    intent: e.intent,
    tags: e.tags,
    text: e.text,
    ageMs: now - e.completedAtMs,
  }));
}

export type CreateAssistantSpeechRendererDeps<TPayload> = {
  readonly resolver: AssistantSpeechResolver;
  readonly getAssistant: () => Assistant<TPayload> | null;
  readonly getLocale: () => string;
  readonly metaFromAction?: (
    action: AssistantSpeakAction
  ) => Readonly<Record<string, unknown>>;
  /** Game-specific LLM coaching context (refs, grounding, tone). */
  readonly llmContextFromAction?: (
    action: AssistantSpeakAction,
    helpers: AssistantSpeechLlmContextHelpers
  ) => AssistantSpeechLlmContext | undefined;
  /** Max resolved lines kept for {@link llmContextFromAction} (default 12). */
  readonly historySize?: number;
  readonly timeoutMs?: number;
};

async function raceResolverSpeak(
  resolver: AssistantSpeechResolver,
  request: AssistantSpeechRequest,
  timeoutMs: number,
  ac: AbortController
): Promise<string | null> {
  const timeoutPromise = new Promise<typeof TIMEOUT_TOKEN>((resolve) => {
    setTimeout(() => resolve(TIMEOUT_TOKEN), timeoutMs);
  });
  try {
    const raced = await Promise.race([
      resolver.resolve(request, ac.signal),
      timeoutPromise,
    ]);
    if (raced === TIMEOUT_TOKEN) {
      ac.abort();
      return null;
    }
    return raced;
  } catch {
    return null;
  }
}

function queueSpeakResolve<TPayload>(
  deps: CreateAssistantSpeechRendererDeps<TPayload>,
  action: AssistantSpeakAction,
  options: {
    readonly mySeq: number;
    readonly getRenderSeq: () => number;
    readonly ac: AbortController;
    readonly timeoutMs: number;
    readonly snapshotHistory: () => readonly AssistantSpeechHistoryLine[];
    readonly appendHistoryOnSuccess: (
      text: string,
      action: AssistantSpeakAction
    ) => void;
  }
): void {
  const inst = deps.getAssistant();
  if (inst === null) {
    return;
  }

  emitAssistantSpeakingMessage(inst, null, { bubbleResolving: true });

  const meta = deps.metaFromAction?.(action) ?? {};
  const helpers: AssistantSpeechLlmContextHelpers = {
    recentLines: options.snapshotHistory(),
  };
  const llm = deps.llmContextFromAction?.(action, helpers);
  const locale = deps.getLocale();
  const request: AssistantSpeechRequest = {
    intent: action.intent,
    payloadRef: action.payloadRef,
    tags: action.tags,
    locale,
    meta,
    ...(llm !== undefined ? { llm } : {}),
  };

  void (async (): Promise<void> => {
    const text = await raceResolverSpeak(
      deps.resolver,
      request,
      options.timeoutMs,
      options.ac
    );
    if (options.mySeq !== options.getRenderSeq()) {
      return;
    }
    const current = deps.getAssistant();
    if (current === null) {
      return;
    }
    if (text === null || text.length === 0) {
      // Resolver failed or timed out — never surface an error string to the
      // player. Leave the bubble in its resolving state until the next speak
      // or silence supersedes it.
      return;
    }
    options.appendHistoryOnSuccess(text, action);
    emitAssistantSpeakingMessage(current, text, {
      bubbleResolving: false,
    });
  })();
}

/**
 * {@link AssistantRenderer} that resolves `speak` lines via
 * {@link AssistantSpeechResolver} (typically LLM-backed). Deterministic
 * policy stays in the engine; this layer only turns a chosen
 * `payloadRef` into display text.
 */
export function createAssistantSpeechRenderer<TPayload>(
  deps: CreateAssistantSpeechRendererDeps<TPayload>
): AssistantRenderer {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const historySize = deps.historySize ?? DEFAULT_HISTORY_SIZE;
  const historyBuffer: HistoryBufferEntry[] = [];

  function appendHistoryOnSuccess(
    text: string,
    speakAction: AssistantSpeakAction
  ): void {
    historyBuffer.push({
      payloadRef: speakAction.payloadRef,
      intent: speakAction.intent,
      tags: speakAction.tags,
      text,
      completedAtMs: Date.now(),
    });
    while (historyBuffer.length > historySize) {
      historyBuffer.shift();
    }
  }

  let renderSeq = 0;
  let abortPrevious: (() => void) | null = null;

  return {
    render(action: AssistantAction): void {
      if (action.kind === 'silence') {
        renderSeq += 1;
        abortPrevious?.();
        abortPrevious = null;
        const inst = deps.getAssistant();
        if (inst !== null) {
          emitAssistantSpeakingMessage(inst, null, {
            bubbleResolving: false,
          });
        }
        return;
      }

      if (action.kind !== 'speak') {
        return;
      }

      renderSeq += 1;
      const mySeq = renderSeq;
      abortPrevious?.();
      const ac = new AbortController();
      abortPrevious = () => {
        ac.abort();
      };

      queueSpeakResolve(deps, action, {
        mySeq,
        getRenderSeq: () => renderSeq,
        ac,
        timeoutMs,
        snapshotHistory: () => snapshotHistoryLines(historyBuffer),
        appendHistoryOnSuccess,
      });
    },
  };
}
