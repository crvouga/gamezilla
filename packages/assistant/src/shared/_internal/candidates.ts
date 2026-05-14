import type { Intent } from './intents';

const CANDIDATE_DATA = Symbol('assistantCandidate');

export type AssistantCandidate = {
  readonly __brand: 'AssistantCandidate';
};

export type CandidateCore = {
  readonly intent: Intent;
  readonly weight: number;
  readonly cost: number;
  readonly cooldownMs: number;
  readonly payloadRef: string;
  readonly tags: readonly string[];
  readonly minSkill?: number | undefined;
  readonly minFrustration?: number | undefined;
};

export function defineCandidate(args: {
  readonly intent: Intent;
  readonly weight: number;
  readonly cost: number;
  readonly cooldownMs: number;
  readonly payloadRef: string;
  readonly tags?: readonly string[] | undefined;
  readonly minSkill?: number | undefined;
  readonly minFrustration?: number | undefined;
}): AssistantCandidate {
  const core: CandidateCore = {
    intent: args.intent,
    weight: args.weight,
    cost: args.cost,
    cooldownMs: args.cooldownMs,
    payloadRef: args.payloadRef,
    tags: args.tags ?? [],
    ...(args.minSkill !== undefined ? { minSkill: args.minSkill } : {}),
    ...(args.minFrustration !== undefined
      ? { minFrustration: args.minFrustration }
      : {}),
  };
  return {
    __brand: 'AssistantCandidate',
    [CANDIDATE_DATA]: core,
  } as unknown as AssistantCandidate;
}

export function readCandidate(candidate: AssistantCandidate): CandidateCore {
  return (
    candidate as unknown as {
      readonly [k: symbol]: CandidateCore;
    }
  )[CANDIDATE_DATA] as CandidateCore;
}
