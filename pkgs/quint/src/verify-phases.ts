import { inductionTargets } from './induction-targets';

export type VerifyPhase = {
  readonly name: 'bounded' | 'initial' | 'preservation' | 'implication';
  readonly invariants: readonly string[];
  readonly maxSteps: number;
  readonly init?: string;
};

/** Induction checks initialization, preservation and implication separately. */
export function verifyPhases(input: {
  readonly source: string;
  readonly module: string;
  readonly invariants: readonly string[];
  readonly maxSteps: number;
  readonly inductiveInvariant?: string;
}): readonly VerifyPhase[] {
  const candidate = input.inductiveInvariant;
  if (candidate === undefined)
    return [
      {
        name: 'bounded',
        invariants: input.invariants,
        maxSteps: input.maxSteps,
      },
    ];
  const targets = inductionTargets({
    source: input.source,
    module: input.module,
    candidate,
    invariants: input.invariants,
  });
  return [
    { name: 'initial', invariants: [candidate], maxSteps: 0 },
    {
      name: 'preservation',
      invariants: [candidate],
      maxSteps: 1,
      init: candidate,
    },
    ...(targets.length === 0
      ? []
      : [
          {
            name: 'implication' as const,
            invariants: targets,
            maxSteps: 0,
            init: candidate,
          },
        ]),
  ];
}
