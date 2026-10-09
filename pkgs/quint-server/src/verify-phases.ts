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
  readonly inductionCaseGroupSize?: number;
  readonly boundedInvariantGroupSize?: number;
}): readonly VerifyPhase[] {
  const candidate = input.inductiveInvariant;
  if (candidate === undefined) return boundedPhases(input);
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
    ...groupSteps(inductionSteps(input), input.inductionCaseGroupSize).flatMap(
      (step, index) => {
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
      }
    ),
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

/** Split only solver obligations, retaining the complete bound in each phase. */
function boundedPhases(input: {
  readonly invariants: readonly string[];
  readonly maxSteps: number;
  readonly boundedInvariantGroupSize?: number;
}): readonly VerifyPhase[] {
  const phase = {
    name: 'bounded' as const,
    invariants: input.invariants,
    maxSteps: input.maxSteps,
  };
  const requested = input.boundedInvariantGroupSize;
  if (requested === undefined || !Number.isFinite(requested) || requested <= 0)
    return [phase];
  const size = Math.max(1, Math.floor(requested));
  if (size >= input.invariants.length) return [phase];
  const phases: VerifyPhase[] = [];
  for (let index = 0; index < input.invariants.length; index += size)
    phases.push({
      ...phase,
      invariants: input.invariants.slice(index, index + size),
      case: phases.length,
    });
  return phases;
}

/** Regroup every alternative; a group's shared frame is their intersection. */
function groupSteps(
  steps: readonly (string | undefined)[],
  requestedSize: number | undefined
): readonly (string | undefined)[] {
  const size = Math.max(1, Math.floor(requestedSize ?? 1));
  if (
    !Number.isFinite(size) ||
    size === 1 ||
    steps.some((step) => step === undefined)
  )
    return steps;
  const groups: string[] = [];
  for (let index = 0; index < steps.length; index += size)
    groups.push(`any { ${steps.slice(index, index + size).join(', ')} }`);
  return groups;
}
