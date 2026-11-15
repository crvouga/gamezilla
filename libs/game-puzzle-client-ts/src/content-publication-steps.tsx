import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import {
  StepTrack,
  type StepTrackStep,
} from '@pkgs/ui-root-client-ts/step-track';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createMemo, type JSX, Show, untrack } from 'solid-js';
import { ContentStatusChip } from './content-chips';

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
  readonly progress:
    | {
        readonly label: string;
        readonly complete: boolean;
        readonly currentLabel: string;
        readonly statusInLead: boolean;
        readonly lead: JSX.Element;
        readonly action: JSX.Element;
      }
    | undefined;
  /** A puzzle's playtest, the first step's action; `true` as the lead. */
  readonly playtest: (lead: boolean) => JSX.Element;
  readonly validate: (place: PublicationActionPlace) => JSX.Element;
  readonly publish: (place: PublicationActionPlace) => JSX.Element;
  /** Opens a pack's first draft puzzle, to publish it there. */
  readonly onOpenWaiting?: (() => void) | undefined;
  /**
   * `false` while the game says the draft cannot be played (its authoring
   * `readable()`): the playtest waits on the editor's corrections.
   */
  readonly playable?: boolean | undefined;
  /**
   * Opens the place that corrects the draft: the board while the game
   * cannot play it, or where a failed check points (`fixTarget`).
   */
  readonly onFix?: ((where: 'details' | 'board') => void) | undefined;
  /** Where the failed check's finding is corrected, when it says. */
  readonly fixTarget?: 'details' | 'board' | undefined;
  /**
   * Why this person cannot publish, said under the Publish step in place
   * of its action (a compact permission denial).
   */
  readonly publishNote?: JSX.Element | undefined;
  /** The server refused the last publication: correcting it comes first. */
  readonly refused?: boolean | undefined;
};

/** The playtest is next but cannot start until the draft is corrected. */
function correctionFirst(props: PublicationStepsProps): boolean {
  return props.next === 'playtest' && props.playable === false;
}

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
    const count = props.waitingOn.length;
    if (props.next === 'puzzles')
      return count === 1
        ? t`1 puzzle is still a draft. Publish it, then the pack.`
        : t`${count} puzzles are still drafts. Publish them, then the pack.`;
    if (correctionFirst(props))
      return t`Next: fix the draft as the editor says, then playtest.`;
    if (props.next === 'playtest')
      return t`Next: finish a playtest to show the puzzle can be solved.`;
    if (props.next === 'publish' && props.refused === true) return '';
    if (props.next === 'publish')
      return t`Ready: publish to share it with everyone who plays.`;
    return props.validation === 'invalid'
      ? t`Next: make the changes it needs, then validate again.`
      : t`Next: validate the draft, then publish it.`;
  };
  return (
    <Show when={line() !== ''}>
      <P
        variant="caption"
        tone="secondary"
        dataSet={{ testid: 'content-publication-status' }}
      >
        {line()}
      </P>
    </Show>
  );
}

/**
 * A pack's lead while its puzzles wait: it opens the first draft one, to
 * finish and publish it there.
 */
function OpenWaiting(props: PublicationStepsProps): JSX.Element {
  const { t } = useLingui();
  return (
    <Button
      title={t`Finish ${props.waitingOn[0] ?? ''}`}
      intent="primary"
      variant="solid"
      onClick={() => props.onOpenWaiting?.()}
      dataSet={{ testid: 'content-open-waiting' }}
    />
  );
}

/**
 * Where correcting the draft leads instead of the next step's own action:
 * the board while the game cannot play it, or where a failed check
 * points. `null` when the step's own action leads.
 */
function fixLead(props: PublicationStepsProps): 'details' | 'board' | null {
  if (props.onFix === undefined) return null;
  if (correctionFirst(props)) return 'board';
  if (props.next === 'validate' && props.validation === 'invalid')
    return props.fixTarget ?? null;
  if (props.next === 'publish' && props.refused === true)
    return props.fixTarget ?? null;
  return null;
}

/** The correction as the lead: it opens the board or the details. */
function FixLead(props: {
  where: 'details' | 'board';
  kind: ContentKind;
  unplayable: boolean;
  onFix: (where: 'details' | 'board') => void;
}): JSX.Element {
  const { t } = useLingui();
  const title = () => {
    if (props.where === 'details') return t`Edit details`;
    if (props.kind === 'pack') return t`Edit puzzles`;
    return props.unplayable ? t`Fix the board` : t`Edit board`;
  };
  return (
    <Button
      title={title()}
      intent="primary"
      variant="solid"
      onClick={() => props.onFix(props.where)}
      dataSet={{ testid: `content-author-fix-${props.where}` }}
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
    const fix = fixLead(props);
    return untrack((): JSX.Element => {
      if (step === 'puzzles') return <OpenWaiting {...props} />;
      const onFix = props.onFix;
      if (fix !== null && onFix !== undefined)
        return (
          <FixLead
            where={fix}
            kind={props.kind}
            unplayable={correctionFirst(props)}
            onFix={onFix}
          />
        );
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
      // While a correction leads, the step it holds up waits: the playtest
      // or a refused Publish again locked (still pressable, to say what is
      // missing), a failed check's Validate again beside its step.
      if (state === 'current' && fixLead(props) !== null)
        return step === 'validate' ? 'done' : 'locked';
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
 * Where a sent copy stands, beside the lead: a word while it is on its
 * way, a Published chip once it is the current edition.
 */
function ProgressStatus(props: {
  progress: PublicationStepsProps['progress'];
}): JSX.Element {
  return (
    <Show when={!props.progress?.statusInLead}>
      <Show
        when={props.progress?.complete}
        fallback={
          <P
            variant="caption"
            tone="secondary"
            dataSet={{ testid: 'content-publication-status' }}
          >
            {props.progress?.label}
          </P>
        }
      >
        <StackHorizontal
          align="center"
          dataSet={{ testid: 'content-publication-status' }}
        >
          <ContentStatusChip status="published" />
        </StackHorizontal>
      </Show>
    </Show>
  );
}

/**
 * Where the draft stands on its way to publishing: the one next step's
 * action, filled, the one thing to press, with a line beside it saying
 * why (under it where the row is narrow); then every step in order as
 * status, each one short line: its number, its name and its state (done,
 * next or locked). A step behind the person keeps its action as an
 * outline; a step that waits keeps its action locked (muted, still
 * pressable, so it can say what is missing).
 */
export function PublicationSteps(props: PublicationStepsProps): JSX.Element {
  const { t } = useLingui();
  const next = createMemo(() => props.next);
  const usualLead = useLead(props, next);
  const lead = () =>
    props.progress === undefined ? usualLead() : props.progress.lead;
  const actions = useTrackActions(props, next);
  const steps = (): StepTrackStep[] => [
    ...(props.kind === 'pack'
      ? [
          {
            key: 'puzzles',
            label: t`Publish puzzles`,
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
      label: props.progress ? t`Publication` : t`Publish`,
      state: props.progress?.complete ? 'done' : stateOf('publish', next()),
      action:
        props.publishNote !== undefined
          ? undefined
          : props.progress === undefined
            ? actions.publish()
            : props.progress.action,
      note: next() === 'publish' ? undefined : props.publishNote,
    },
  ];
  return (
    <StackVertical gap="md">
      <StackHorizontal gap="md" wrap align="center">
        {lead()}
        <Show
          when={props.progress === undefined}
          fallback={<ProgressStatus progress={props.progress} />}
        >
          <NextLine {...props} />
        </Show>
      </StackHorizontal>
      <StepTrack
        label={t`Steps to publish`}
        stateNames={{
          done: t`Done`,
          current:
            props.progress?.currentLabel ??
            (correctionFirst(props) || fixLead(props) !== null
              ? t`Fix first`
              : t`Next`),
          upcoming: t`Locked`,
        }}
        steps={steps()}
        dataSet={{ testid: 'content-publication-steps' }}
      />
    </StackVertical>
  );
}
