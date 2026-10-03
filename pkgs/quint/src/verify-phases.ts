import { preservationTargets } from './induction-frame';
import { inductionSteps } from './induction-steps';
import { inductionTargets } from './induction-targets';

export type VerifyPhase = {
  readonly name:
    | 'bounded'
    | 'induction'
    | 'initial'
    | 'preservation'
    | 'implication';
  readonly invariants: readonly string[];
  readonly maxSteps: number;
  readonly init?: string;
  readonly inductiveInvariant?: string;
  readonly step?: string;
  readonly case?: number;
};

/** Induction checks initialization, preservation and implication separately. */
export function verifyPhases(input: {
  readonly source: string;
  readonly module: string;
  readonly invariants: readonly string[];
  readonly maxSteps: number;
  readonly inductiveInvariant?: string;
  readonly separateInduction?: boolean;
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
  if (input.separateInduction !== true)
    return [
      {
        name: 'induction',
        invariants: targets,
        maxSteps: input.maxSteps,
        inductiveInvariant: candidate,
      },
    ];
  return [
    { name: 'initial', invariants: [candidate], maxSteps: 0 },
    ...inductionSteps(input).flatMap((step, index) => {
      const invariants =
        step === undefined
          ? [candidate]
          : preservationTargets({ ...input, candidate, step });
      return invariants.length === 0
        ? []
        : [
            {
              name: 'preservation' as const,
              invariants,
              maxSteps: 1,
              init: candidate,
              ...(step === undefined ? {} : { step }),
              case: index,
            },
          ];
    }),
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
