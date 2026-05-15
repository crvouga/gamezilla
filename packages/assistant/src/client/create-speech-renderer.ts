import type { Assistant } from '../shared/index';
import type {
  AssistantAction,
  AssistantSpeakAction,
} from '../shared/_internal/action';
import type { AssistantRenderer } from '../shared/_internal/renderer';
import type {
  AssistantSpeechRequest,
  AssistantSpeechResolver,
} from '../shared/speech-resolver';
import { emitAssistantSpeakingMessage } from './_internal/assistant-speaking-bridge';

const DEFAULT_TIMEOUT_MS = 30_000;

export const ASSISTANT_SPEECH_FALLBACK_LINE = "Can't reach coach right now.";

const TIMEOUT_TOKEN = Symbol('timeout');

export type CreateAssistantSpeechRendererDeps<TPayload> = {
  readonly resolver: AssistantSpeechResolver;
  readonly getAssistant: () => Assistant<TPayload> | null;
  readonly getLocale: () => string;
  readonly metaFromAction?: (
    action: AssistantSpeakAction
  ) => Readonly<Record<string, unknown>>;
  readonly timeoutMs?: number;
  /** Shown when the resolver returns null or times out (e.g. i18n). */
  readonly fallbackSpeech?: () => string;
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
  }
): void {
  const inst = deps.getAssistant();
  if (inst === null) {
    return;
  }

  emitAssistantSpeakingMessage(inst, null, { bubbleResolving: true });

  const meta = deps.metaFromAction?.(action) ?? {};
  const locale = deps.getLocale();
  const request: AssistantSpeechRequest = {
    intent: action.intent,
    payloadRef: action.payloadRef,
    tags: action.tags,
    locale,
    meta,
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
    const line =
      text !== null && text.length > 0
        ? text
        : (deps.fallbackSpeech?.() ?? ASSISTANT_SPEECH_FALLBACK_LINE);
    emitAssistantSpeakingMessage(current, line, {
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
      });
    },
  };
}
