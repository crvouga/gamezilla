import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import { useLingui } from '@lingui/solid/macro';
import {
  StepTrack,
  type StepTrackStep,
} from '@pkgs/ui-root-client-ts/step-track';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';

/** The one step that comes next on the way to publishing a draft. */
export type PublicationStep = 'puzzles' | 'playtest' | 'validate' | 'publish';

export type PublicationStepsProps = {
  readonly kind: ContentKind;
  readonly validation: 'unchecked' | 'valid' | 'invalid' | null;
  readonly proven: boolean;
  /** A pack's puzzles that are still drafts, by title. */
  readonly waitingOn: readonly string[];
  readonly next: PublicationStep;
  /** A puzzle's playtest, the first step's action. */
  readonly playtest: JSX.Element;
  readonly validate: JSX.Element;
  readonly publish: JSX.Element;
};

/**
 * The one next step, filled: a pack's draft puzzles are published first, a
 * puzzle's playtest proves it, then Validate until the draft passes its
 * check, then Publish. Publish stays pressable before then: it says what
 * is missing.
 */
export function publicationNextStep(args: {
  readonly validation: PublicationStepsProps['validation'];
  readonly needsProof?: boolean | undefined;
  readonly waiting?: boolean | undefined;
}): PublicationStep {
  if (args.waiting === true) return 'puzzles';
  if (args.needsProof === true) return 'playtest';
  return args.validation === 'valid' ? 'publish' : 'validate';
}

const ORDER: readonly PublicationStep[] = [
  'puzzles',
  'playtest',
  'validate',
  'publish',
];

function stateOf(
  step: PublicationStep,
  next: PublicationStep
): StepTrackStep['state'] {
  if (step === next) return 'current';
  return ORDER.indexOf(step) < ORDER.indexOf(next) ? 'done' : 'upcoming';
}

/** What to do next, in one line of text over the steps. */
function NextLine(props: PublicationStepsProps): JSX.Element {
  const { t } = useLingui();
  const line = (): string => {
    const titles = props.waitingOn.join(', ');
    if (props.next === 'puzzles')
      return t`Next: publish ${titles} first. A pack holds only published puzzles.`;
    if (props.next === 'playtest')
      return t`Next: finish a playtest to show the puzzle can be solved.`;
    if (props.next === 'publish')
      return t`Ready: publish to share it with everyone who plays.`;
    return props.validation === 'invalid'
      ? t`Next: make the changes it needs, then validate again.`
      : t`Next: validate the draft, then publish it.`;
  };
  return (
    <P
      variant="caption"
      tone="secondary"
      dataSet={{ testid: 'content-publication-status' }}
    >
      {line()}
    </P>
  );
}

/**
 * Where the draft stands on its way to publishing, as one sequence: a
 * line saying the one next step, then the steps in order, each with its
 * marker (done, next or waiting) and its action, the next one filled.
 */
export function PublicationSteps(props: PublicationStepsProps): JSX.Element {
  const { t } = useLingui();
  const steps = (): StepTrackStep[] => [
    ...(props.kind === 'pack'
      ? [
          {
            key: 'puzzles',
            label:
              props.waitingOn.length === 0
                ? t`Puzzles published`
                : t`Publish its puzzles`,
            state: stateOf('puzzles', props.next),
            dataSet: { testid: 'content-pack-puzzles-step' },
          },
        ]
      : [
          {
            key: 'playtest',
            label: t`Playtest`,
            state: stateOf('playtest', props.next),
            action: props.playtest,
            dataSet: { testid: 'content-proof', proven: String(props.proven) },
          },
        ]),
    {
      key: 'validate',
      label: t`Validate`,
      state:
        props.validation === 'valid' ? 'done' : stateOf('validate', props.next),
      action: props.validate,
      dataSet:
        props.validation === 'valid'
          ? { testid: 'content-validation-passed' }
          : { testid: 'content-validation-step' },
    },
    {
      key: 'publish',
      label: t`Publish`,
      state: stateOf('publish', props.next),
      action: props.publish,
    },
  ];
  return (
    <>
      <NextLine {...props} />
      <StepTrack
        label={t`Steps to publish`}
        stateNames={{ done: t`Done`, current: t`Next`, upcoming: t`Later` }}
        steps={steps()}
        dataSet={{ testid: 'content-publication-steps' }}
      />
    </>
  );
}
