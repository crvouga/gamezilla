import { preservationTargets } from './induction-frame';
import { inductionSteps } from './induction-steps';
import { inductionTargets } from './induction-targets';

export type PhaseSelection = {
  readonly indexes: readonly number[];
  readonly count: number;
};

/**
 * The phases a task runs. An unsplit check runs all of them. A split task
 * runs the indexes it names, and refuses a count that no longer matches
 * the model: a new induction case must be given its own task rather than
 * skipped.
 */
export function selectVerifyPhase(
  phases: readonly VerifyPhase[],
  selection: PhaseSelection | undefined
): { readonly phases: readonly VerifyPhase[] } | { readonly error: string } {
  if (selection === undefined) return { phases };
  if (phases.length !== selection.count) {
    return {
      error: `this model has ${String(phases.length)} proof phases, and the task asked for ${String(selection.count)} — update the package's phase split`,
    };
  }
  return pickPhases(phases, selection.indexes);
}

function pickPhases(
  phases: readonly VerifyPhase[],
  indexes: readonly number[]
): { readonly phases: readonly VerifyPhase[] } | { readonly error: string } {
  if (indexes.length === 0) {
    return { error: 'the task asked for no proof phase' };
  }
  const picked: VerifyPhase[] = [];
  const seen = new Set<number>();
  for (const index of indexes) {
    if (seen.has(index)) {
      return { error: `proof phase ${String(index)} is listed twice` };
    }
    seen.add(index);
    const phase = phases[index];
    if (phase === undefined) {
      return {
        error: `proof phase ${String(index)} is not among ${String(phases.length)}`,
      };
    }
    picked.push(phase);
  }
  return { phases: picked };
}

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
