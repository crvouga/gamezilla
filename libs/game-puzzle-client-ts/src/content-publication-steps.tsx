import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import {
  StepTrack,
  type StepTrackStep,
} from '@pkgs/ui-root-client-ts/step-track';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createMemo, type JSX, untrack } from 'solid-js';

/** The one step that comes next on the way to publishing a draft. */
export type PublicationStep = 'puzzles' | 'playtest' | 'validate' | 'publish';

/**
 * Where a step's action is drawn: `lead`, filled over the steps as the one
 * next action; `done`, an outline in its step behind the person; `locked`,
 * muted behind a lock in a step that waits, still pressable so it can say
 * what is missing.
 */
export type PublicationActionPlace = 'lead' | 'done' | 'locked';

export type PublicationStepsProps = {
  readonly kind: ContentKind;
  readonly validation: 'unchecked' | 'valid' | 'invalid' | null;
  readonly proven: boolean;
  /** A pack's puzzles that are still drafts, by title. */
  readonly waitingOn: readonly string[];
  readonly next: PublicationStep;
  /** A puzzle's playtest, the first step's action; `true` as the lead. */
  readonly playtest: (lead: boolean) => JSX.Element;
  readonly validate: (place: PublicationActionPlace) => JSX.Element;
  readonly publish: (place: PublicationActionPlace) => JSX.Element;
  /** Opens a pack's first draft puzzle, to publish it there. */
  readonly onOpenWaiting?: (() => void) | undefined;
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

/** Why the lead action is next, in one line of text beside it. */
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

/** A pack's lead while its puzzles wait: open the first draft one. */
function OpenWaiting(props: PublicationStepsProps): JSX.Element {
  const { t } = useLingui();
  return (
    <Button
      title={t`Open ${props.waitingOn[0] ?? ''} to publish it`}
      intent="primary"
      variant="solid"
      onClick={() => props.onOpenWaiting?.()}
      dataSet={{ testid: 'content-open-waiting' }}
    />
  );
}

/**
 * The one next action, drawn once per step it leads (so a step's own
 * state, a started playtest's "Open playtest", lasts while it leads).
 */
function useLead(
  props: PublicationStepsProps,
  next: () => PublicationStep
): () => JSX.Element {
  return createMemo(() => {
    const step = next();
    return untrack((): JSX.Element => {
      if (step === 'puzzles') return <OpenWaiting {...props} />;
      if (step === 'playtest') return props.playtest(true);
      return step === 'validate'
        ? props.validate('lead')
        : props.publish('lead');
    });
  });
}

/** Each step's action in the track, drawn again only when its place changes. */
function useTrackActions(
  props: PublicationStepsProps,
  next: () => PublicationStep
) {
  const place = (step: 'playtest' | 'validate' | 'publish') =>
    createMemo((): PublicationActionPlace => {
      if (
        step === 'validate' &&
        props.validation === 'valid' &&
        next() !== step
      )
        return 'done';
      const state = stateOf(step, next());
      if (state === 'current') return 'lead';
      return state === 'done' ? 'done' : 'locked';
    });
  const drawn = (
    at: () => PublicationActionPlace,
    draw: (where: PublicationActionPlace) => JSX.Element
  ) =>
    createMemo(() => {
      const where = at();
      return where === 'lead' ? undefined : untrack(() => draw(where));
    });
  return {
    playtest: drawn(place('playtest'), () => props.playtest(false)),
    validate: drawn(place('validate'), (where) => props.validate(where)),
    publish: drawn(place('publish'), (where) => props.publish(where)),
  };
}

/**
 * What a waiting step waits on: the nearest step before it not yet done.
 */
function waitNotes(
  steps: readonly StepTrackStep[],
  names: Readonly<Record<string, string>>
): StepTrackStep[] {
  return steps.map((step, index) => {
    if (step.state !== 'upcoming') return step;
    const before = steps
      .slice(0, index)
      .findLast((earlier) => earlier.state !== 'done');
    return before === undefined ? step : { ...step, note: names[before.key] };
  });
}

/**
 * Where the draft stands on its way to publishing: the one next step's
 * action, filled, the one thing to press, with a line beside it saying
 * why (under it where the row is narrow); then every step in order as
 * status, each with its marker (done,
 * next or waiting). A step behind the person keeps its action as an
 * outline; a step that waits keeps its action locked (muted, still
 * pressable, so it can say what is missing) and says what it waits on.
 */
export function PublicationSteps(props: PublicationStepsProps): JSX.Element {
  const { t } = useLingui();
  const next = createMemo(() => props.next);
  const lead = useLead(props, next);
  const actions = useTrackActions(props, next);
  const names = (): Record<string, string> => ({
    puzzles: t`After its puzzles`,
    playtest: t`After the playtest`,
    validate: t`After validation`,
  });
  const steps = (): StepTrackStep[] =>
    waitNotes(
      [
        ...(props.kind === 'pack'
          ? [
              {
                key: 'puzzles',
                label:
                  props.waitingOn.length === 0
                    ? t`Puzzles published`
                    : t`Publish its puzzles`,
                state: stateOf('puzzles', next()),
                dataSet: { testid: 'content-pack-puzzles-step' },
              },
            ]
          : [
              {
                key: 'playtest',
                label: t`Playtest`,
                state: stateOf('playtest', next()),
                action: actions.playtest(),
                dataSet: {
                  testid: 'content-proof',
                  proven: String(props.proven),
                },
              },
            ]),
        {
          key: 'validate',
          label: t`Validate`,
          state:
            props.validation === 'valid' ? 'done' : stateOf('validate', next()),
          action: actions.validate(),
          dataSet:
            props.validation === 'valid'
              ? { testid: 'content-validation-passed' }
              : { testid: 'content-validation-step' },
        },
        {
          key: 'publish',
          label: t`Publish`,
          state: stateOf('publish', next()),
          action: actions.publish(),
        },
      ],
      names()
    );
  return (
    <StackVertical gap="md">
      <StackHorizontal gap="md" wrap align="center">
        {lead()}
        <NextLine {...props} />
      </StackHorizontal>
      <StepTrack
        label={t`Steps to publish`}
        stateNames={{ done: t`Done`, current: t`Next`, upcoming: t`Later` }}
        steps={steps()}
        dataSet={{ testid: 'content-publication-steps' }}
      />
    </StackVertical>
  );
}
