import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ChevronDownIcon, ChevronUpIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import {
  StepTrack,
  type StepTrackStep,
} from '@pkgs/ui-root-client-ts/step-track';
import { P } from '@pkgs/ui-root-client-ts/text';
import {
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  untrack,
} from 'solid-js';
import { usePublicationLeadSlot } from './content-publication-lead';

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
    const count = props.waitingOn.length;
    if (props.next === 'puzzles')
      return count === 1
        ? t`1 puzzle is still a draft. Publish it, then the pack.`
        : t`${count} puzzles are still drafts. Publish them, then the pack.`;
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
 * The lead drawn in the screen's slot while one asks for it (a phone's
 * title row), else over the steps; `true` while it is away.
 */
function useLeadPlace(lead: () => JSX.Element): () => boolean {
  const slot = usePublicationLeadSlot();
  const away = (): boolean => slot?.active() === true;
  createEffect(() => slot?.show(away() ? lead() : undefined));
  onCleanup(() => slot?.show(undefined));
  return away;
}

/** The steps in order, by kind: a pack's puzzles or a puzzle's playtest first. */
function stepOrder(kind: ContentKind): readonly PublicationStep[] {
  return kind === 'pack'
    ? ['puzzles', 'validate', 'publish']
    : ['playtest', 'validate', 'publish'];
}

/**
 * Every step in order as a checklist, each one short line: its number, its
 * name and its state (done, next or locked), opened from the summary line.
 */
function StepChecklist(props: PublicationStepsProps): JSX.Element {
  const { t } = useLingui();
  const names = (): Readonly<Record<PublicationStep, string>> => ({
    puzzles: t`Publish puzzles`,
    playtest: t`Playtest`,
    validate: t`Validate`,
    publish: t`Publish`,
  });
  const steps = (): StepTrackStep[] =>
    stepOrder(props.kind).map((step) => ({
      key: step,
      label: names()[step],
      state:
        step === 'validate' && props.validation === 'valid'
          ? 'done'
          : stateOf(step, props.next),
    }));
  return (
    <StepTrack
      label={t`Steps to publish`}
      stateNames={{ done: t`Done`, current: t`Next`, upcoming: t`Locked` }}
      steps={steps()}
      dataSet={{ testid: 'content-publication-steps' }}
    />
  );
}

/**
 * Where the draft stands, one quiet line: "Step 1 of 3 · Playtest", which
 * opens the whole checklist under it.
 */
function StepSummary(props: {
  steps: PublicationStepsProps;
  open: boolean;
  onToggle: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const names = (): Readonly<Record<PublicationStep, string>> => ({
    puzzles: t`Publish puzzles`,
    playtest: t`Playtest`,
    validate: t`Validate`,
    publish: t`Publish`,
  });
  const line = (): string => {
    const order = stepOrder(props.steps.kind);
    const step = String(order.indexOf(props.steps.next) + 1);
    const total = String(order.length);
    const name = names()[props.steps.next];
    return t`Step ${step} of ${total} · ${name}`;
  };
  return (
    <Button
      title={line()}
      intent="neutral"
      variant="ghost"
      size="sm"
      endIcon={
        props.open ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />
      }
      aria-expanded={props.open}
      onClick={() => props.onToggle()}
      dataSet={{ testid: 'content-publication-summary' }}
    />
  );
}

/**
 * The steps' own actions that are not the lead, small and quiet: a step
 * behind the person an outline, a step that waits locked (muted, still
 * pressable, so pressing it says what is missing). Each sits in a group
 * named for its step, which says what that step has proven.
 */
function OtherActions(props: {
  steps: PublicationStepsProps;
  actions: ReturnType<typeof useTrackActions>;
}): JSX.Element {
  return (
    <StackHorizontal gap="xs" wrap align="center">
      <Show when={props.steps.kind === 'puzzle'}>
        <StackHorizontal
          align="center"
          dataSet={{
            testid: 'content-proof',
            proven: String(props.steps.proven),
          }}
        >
          {props.actions.playtest()}
        </StackHorizontal>
      </Show>
      <StackHorizontal
        align="center"
        dataSet={{
          testid:
            props.steps.validation === 'valid'
              ? 'content-validation-passed'
              : 'content-validation-step',
        }}
      >
        {props.actions.validate()}
      </StackHorizontal>
      {props.actions.publish()}
    </StackHorizontal>
  );
}

/**
 * Where the draft stands on its way to publishing, in one quiet row: the
 * step it is on ("Step 1 of 3 · Playtest", which opens every step as a
 * checklist), a line saying why that step is next, and the other steps'
 * actions, small (a step that waits locked, still pressable, so pressing
 * Publish says what is missing). The one next step's action, filled, is
 * drawn in the screen's title row where the screen asks for it, else at
 * the start of the row.
 */
export function PublicationSteps(props: PublicationStepsProps): JSX.Element {
  const next = createMemo(() => props.next);
  const lead = useLead(props, next);
  const away = useLeadPlace(lead);
  const actions = useTrackActions(props, next);
  const [open, setOpen] = createSignal(false);
  return (
    <StackVertical gap="sm">
      <StackHorizontal gap="md" wrap align="center" justify="between">
        <Show when={!away()}>{lead()}</Show>
        <StackVertical gap="none">
          <StepSummary
            steps={props}
            open={open()}
            onToggle={() => setOpen((was) => !was)}
          />
          <NextLine {...props} />
        </StackVertical>
        <OtherActions steps={props} actions={actions} />
      </StackHorizontal>
      <Show when={open()}>
        <StepChecklist {...props} />
      </Show>
    </StackVertical>
  );
}
