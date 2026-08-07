import type {
  AssistantAction,
  AssistantSpeakAction,
} from '../shared/_internal/action';
import type { AssistantClock } from '../shared/_internal/clock';
import type { AssistantRenderer } from '../shared/_internal/renderer';
import { createSplitMix32, hashSeedString } from '../shared/_internal/rng';
import type {
  DialogueContext,
  DialogueLookupKey,
  DialogueTree,
} from '../shared/dialogue-tree';
import {
  type DialogueRng,
  pickDialogueVariant,
  substituteDialogueText,
} from '../shared/dialogue-tree';
import type { Assistant } from '../shared/index';
import { emitAssistantSpeakingMessage } from './_internal/assistant-speaking-bridge';

export type CreateAssistantDialogueTreeRendererDeps<TPayload> = {
  readonly getAssistant: () => Assistant<TPayload> | null;
  readonly tree: DialogueTree;
  readonly clock: AssistantClock;
  readonly contextFromAction: (action: AssistantSpeakAction) => DialogueContext;
  readonly rng?: DialogueRng;
  readonly rngSeed?: string;
};

type SequencePlayer = {
  cancel(): void;
  play(
    steps: readonly { readonly text: string; readonly holdMs: number }[],
    ctx: DialogueContext,
    emitLine: (text: string | null) => void
  ): void;
};

function createSequencePlayer(clock: AssistantClock): SequencePlayer {
  let handle: { cancel(): void } | null = null;
  let gen = 0;

  return {
    cancel() {
      gen += 1;
      handle?.cancel();
      handle = null;
    },
    play(steps, ctx, emitLine) {
      this.cancel();
      const myGen = (gen += 1);
      let stepIdx = 0;

      const playStep = (): void => {
        if (myGen !== gen) return;
        const step = steps[stepIdx];
        if (step === undefined) return;
        const text = substituteDialogueText(step.text, ctx);
        emitLine(text.length > 0 ? text : null);
        stepIdx += 1;
        if (stepIdx >= steps.length) return;
        const prev = steps[stepIdx - 1];
        if (prev === undefined) return;
        handle = clock.setTimeout(playStep, prev.holdMs);
      };

      playStep();
    },
  };
}

function emitLineForAssistant<TPayload>(
  getAssistant: () => Assistant<TPayload> | null,
  text: string | null
): void {
  const inst = getAssistant();
  if (inst === null) return;
  emitAssistantSpeakingMessage(inst, text, { bubbleResolving: false });
}

function resolveSingleLine(args: {
  readonly node: { readonly variants: readonly string[] };
  readonly lookupKey: DialogueLookupKey;
  readonly ctx: DialogueContext;
  readonly rng: DialogueRng;
  readonly lastIndexByKey: Map<string, number>;
}): string | null {
  return pickDialogueVariant({
    variants: args.node.variants,
    lookupKey: args.lookupKey,
    ctx: args.ctx,
    rng: args.rng,
    lastIndexByKey: args.lastIndexByKey,
  });
}

export function createAssistantDialogueTreeRenderer<TPayload>(
  deps: CreateAssistantDialogueTreeRendererDeps<TPayload>
): AssistantRenderer {
  const rng =
    deps.rng ??
    createSplitMix32(hashSeedString(deps.rngSeed ?? 'dialogue-tree'));
  const lastIndexByKey = new Map<string, number>();
  const sequence = createSequencePlayer(deps.clock);
  const emit = (text: string | null) =>
    emitLineForAssistant(deps.getAssistant, text);

  function renderSpeak(action: AssistantSpeakAction): void {
    const lookupKey = action.dialogueKey;
    if (lookupKey === undefined) return;
    const ctx = deps.contextFromAction(action);
    const node = deps.tree.lookup(lookupKey, ctx);
    if (node === null) return;

    sequence.cancel();
    if (node.kind === 'sequence') {
      if (node.steps.length === 0) return;
      sequence.play(node.steps, ctx, emit);
      return;
    }

    const text = resolveSingleLine({
      node,
      lookupKey,
      ctx,
      rng,
      lastIndexByKey,
    });
    if (text === null || text.length === 0) return;
    emit(text);
  }

  return {
    render(action: AssistantAction): void {
      if (action.kind === 'silence') {
        sequence.cancel();
        emit(null);
        return;
      }
      if (action.kind !== 'speak') return;
      renderSpeak(action);
    },
  };
}
