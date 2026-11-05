/** @jsxImportSource solid-js */

import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import type { Notification } from '@libs/notifications-shared-ts/notification';
import type {
  NotificationAction,
  NotificationCardActions,
} from '@libs/notifications-shared-ts/notification-action';
import { notificationTimeCritical } from '@libs/notifications-shared-ts/notifications-sections';
import { DeviceAvatar } from '@libs/profile-client-ts/device-avatar';
import { parseAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { useLingui } from '@lingui/solid/macro';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Icon } from '@pkgs/ui-root-client-ts/icon';
import { ClockIcon } from '@pkgs/ui-root-client-ts/icons';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { useRelativeTimeLabel } from '@pkgs/ui-root-client-ts/relative-time';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { StatusDot } from '@pkgs/ui-root-client-ts/status-dot';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, For, type JSX, Show } from 'solid-js';

import { InboxCardMenu } from './inbox-card-menu';
import {
  NotificationActionButton,
  primaryNotificationActionId,
} from './notification-action-button';
import { displayNotification } from './notification-display';

/** The default face: `md`, so every card's text column starts at one x. */
const LEADING_SIZE = 40;

/** The unread dot before a title: about the height of its lowercase letters. */
const UNREAD_DOT_SIZE = 8;

/** What a person can see: still waiting to be opened, or already opened. */
function cardState(unread: boolean): ComponentDataSet {
  return { 'inbox-state': unread ? 'waiting' : 'opened' };
}

/**
 * Who the notification is about: their face when it carries their avatar,
 * else their initials, else the person placeholder.
 */
function DefaultLeading(props: {
  readonly interaction: Notification;
}): JSX.Element {
  return (
    <Show
      when={props.interaction.avatar}
      keyed
      fallback={<Avatar size={LEADING_SIZE} />}
    >
      {(avatar) => (
        <DeviceAvatar
          avatarConfig={parseAvatarConfig(avatar.avatarConfig ?? null)}
          seedFallback={avatar.fallbackLabel.replace(/^@/, '')}
          name={avatar.fallbackLabel}
          size={LEADING_SIZE}
        />
      )}
    </Show>
  );
}

/** When it came, then what kind it is: one line ("1h ago · Space invite"). */
function metaLine(parts: readonly (string | undefined)[]): string {
  return parts
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join(' · ');
}

/**
 * The card's title, in the body weight. Unread is marked once, by the dot
 * in the card's leading gutter, never by a heavier weight too.
 */
function CardTitle(props: {
  readonly title: string;
  readonly inactive: boolean;
}): JSX.Element {
  return (
    <P variant="body" tone={props.inactive ? 'secondary' : undefined} lines={3}>
      {props.title}
    </P>
  );
}

/**
 * How little time is left, on a notice whose time is running out: a clock
 * and the words in the warning ink, so it reads before the routine cards.
 */
function TimeCriticalLine(props: { readonly text: string }): JSX.Element {
  return (
    <StackHorizontal
      align="center"
      gap="xs"
      dataSet={{ 'inbox-urgency': 'time-critical' }}
    >
      <Icon icon={ClockIcon} size="sm" tone="warning" />
      <P variant="label" tone="warning" lines={2}>
        {props.text}
      </P>
    </StackHorizontal>
  );
}

/** When it came and what kind it is, as one quiet caption. */
function CardMeta(props: { readonly interaction: Notification }): JSX.Element {
  const relative = useRelativeTimeLabel(() => props.interaction.createdAt);
  const meta = createMemo(() =>
    metaLine([relative(), props.interaction.subtitle])
  );
  return (
    <P variant="caption" testId="notification-card-meta">
      {meta()}
    </P>
  );
}

function InteractionRowText(props: {
  readonly interaction: Notification;
  /** Nothing can be answered any more: the words step back. */
  readonly inactive: boolean;
  /** The caption saying when; false when it rides on the answers' row. */
  readonly showMeta: boolean;
}): JSX.Element {
  const body = (): string | undefined =>
    props.interaction.body !== undefined && props.interaction.body.length > 0
      ? props.interaction.body
      : undefined;
  return (
    <StackVertical grow>
      <CardTitle title={props.interaction.title} inactive={props.inactive} />
      <Show when={props.showMeta}>
        <CardMeta interaction={props.interaction} />
      </Show>
      <Show when={body()} keyed>
        {(text) => (
          <Show
            when={notificationTimeCritical(props.interaction)}
            fallback={
              <P variant="caption" lines={2}>
                {text}
              </P>
            }
          >
            <TimeCriticalLine text={text} />
          </Show>
        )}
      </Show>
    </StackVertical>
  );
}

/** The words of the card; pressing them opens it (the whole block takes the press tint). */
function CardHeadline(props: {
  readonly interaction: Notification;
  readonly inactive: boolean;
  readonly showMeta: boolean;
  readonly onOpen: (() => void) | undefined;
  readonly testId: string | undefined;
  readonly dataSet: ComponentDataSet | undefined;
}): JSX.Element {
  return (
    <Show
      when={props.onOpen}
      keyed
      fallback={
        <InteractionRowText
          interaction={props.interaction}
          inactive={props.inactive}
          showMeta={props.showMeta}
        />
      }
    >
      {(open) => (
        <Pressable
          direction="horizontal"
          align="start"
          grow
          radius="control"
          onPress={open}
          testId={props.testId}
          dataSet={props.dataSet}
        >
          <InteractionRowText
            interaction={props.interaction}
            inactive={props.inactive}
            showMeta={props.showMeta}
          />
        </Pressable>
      )}
    </Show>
  );
}

/**
 * Why an answer cannot be given right now ("Space is full"), told as a
 * neutral tag in the answer's place: a fact, never a button that does
 * nothing.
 */
function UnavailableAnswer(props: { readonly reason: string }): JSX.Element {
  return (
    <StackVertical>
      <Badge
        label={props.reason}
        intent="neutral"
        dataSet={{ 'inbox-answer': 'unavailable' }}
      />
    </StackVertical>
  );
}

/** Every answer the card offers is unavailable: it waits on nobody. */
function everyAnswerUnavailable(
  actions: readonly NotificationAction[]
): boolean {
  return (
    actions.length > 0 && actions.every((action) => action.disabled === true)
  );
}

/** Each published answer: a mutation pill, or the reason it is unavailable. */
function CardAnswers(props: {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
  readonly inline: readonly NotificationAction[];
  readonly actionTestID?:
    | ((action: NotificationAction) => string | undefined)
    | undefined;
}): JSX.Element {
  // Only a card that waits on the person has a main answer: an update's
  // own choices (Dismiss on a game result) stay outlined, so the timeline
  // never fills with solid pills competing with what needs the person.
  const primaryId = createMemo(() =>
    props.interaction.category === 'action_required'
      ? primaryNotificationActionId(props.inline)
      : undefined
  );
  return (
    <For each={props.inline}>
      {(action) => (
        <Show
          when={action.disabled === true ? action.disabledReason : undefined}
          keyed
          fallback={
            <NotificationActionButton
              interaction={props.interaction}
              action={action}
              actions={props.actions}
              emphasis={action.id === primaryId() ? 'primary' : 'secondary'}
              testID={props.actionTestID?.(action)}
            />
          }
        >
          {(reason) => <UnavailableAnswer reason={reason} />}
        </Show>
      )}
    </For>
  );
}

/**
 * The card's one explicit next step when it waits on the person but
 * publishes no answers of its own (a turn waiting on you): the same thing
 * pressing its words does, as an outlined pill. Only a card's own main
 * answer (Join, Accept) is solid, so two cards never compete for the eye.
 */
function CardOpenAnswer(props: {
  readonly label: string | undefined;
  readonly onOpen: (() => void) | undefined;
}): JSX.Element {
  return (
    <Show when={props.onOpen} keyed>
      {(open) => (
        <Show when={props.label} keyed>
          {(label) => (
            <Button
              title={label}
              size="sm"
              intent="neutral"
              variant="outline"
              onClick={open}
            />
          )}
        </Show>
      )}
    </Show>
  );
}

/** The card's "…" menu (Archive), quiet at its top trailing corner. */
function CardMenu(props: {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
  readonly cardTestID: string | undefined;
}): JSX.Element {
  return (
    <Show when={props.cardTestID} keyed>
      {(cardTestID) => (
        // A column of its own, so the trigger keeps to the top corner
        // instead of centring on a tall card.
        <StackVertical>
          <InboxCardMenu
            cardTestId={cardTestID}
            onArchive={() => {
              void props.actions.archive(props.interaction.id);
            }}
          />
        </StackVertical>
      )}
    </Show>
  );
}

/**
 * The card's answers under its words: the main one as the solid pill,
 * other choices as outlines, an unavailable one as its reason in a neutral
 * tag, or its one explicit open step. Nothing is drawn when the card has
 * neither, so an update stays one compact block.
 */
/** The explicit open step a card shows when it publishes no answers. */
function openStepLabel(
  inline: readonly NotificationAction[],
  openLabel: string | undefined
): string | undefined {
  return inline.length === 0 ? openLabel : undefined;
}

/** Whether the card draws a row of answers (or its one open step). */
function hasAnswerRow(
  inline: readonly NotificationAction[],
  openLabel: string | undefined,
  onOpen: (() => void) | undefined
): boolean {
  return (
    inline.length > 0 ||
    (openStepLabel(inline, openLabel) !== undefined && onOpen !== undefined)
  );
}

function CardActionsRow(props: {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
  readonly inline: readonly NotificationAction[];
  readonly openLabel: string | undefined;
  readonly onOpen: (() => void) | undefined;
  readonly actionTestID?:
    | ((action: NotificationAction) => string | undefined)
    | undefined;
  /** Beside the words (a desktop): one line that never wraps. */
  readonly beside?: boolean | undefined;
  /** After the answers on their row (a phone): when the card came. */
  readonly trailing?: JSX.Element | undefined;
}): JSX.Element {
  return (
    <Show when={hasAnswerRow(props.inline, props.openLabel, props.onOpen)}>
      <StackHorizontal align="center" gap="sm" wrap={props.beside !== true}>
        <CardAnswers
          interaction={props.interaction}
          actions={props.actions}
          inline={props.inline}
          actionTestID={props.actionTestID}
        />
        <CardOpenAnswer
          label={openStepLabel(props.inline, props.openLabel)}
          onOpen={props.onOpen}
        />
        {props.trailing}
      </StackHorizontal>
    </Show>
  );
}

export type NotificationCardDefaultProps = {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
  /** Opens the deep-link / profile when the card's words are pressed. */
  readonly onOpen?: (() => void) | undefined;
  /**
   * What pressing the card's words does instead of {@link onOpen}, for a sub
   * that handles its own cards (a decision dialog, say).
   */
  readonly onPress?: (() => void) | undefined;
  /**
   * When false, hides published action buttons.
   * Defaults to true.
   */
  readonly showInlineActions?: boolean | undefined;
  readonly leading?: JSX.Element | undefined;
  readonly actionTestID?:
    | ((action: NotificationAction) => string | undefined)
    | undefined;
  /** Addresses the card; also gives it the "…" menu with Archive. */
  readonly testID?: string | undefined;
  /**
   * The explicit next step's label on a card that waits on the person but
   * shows no answers ("Respond"). Defaults to "Open" for such a card.
   */
  readonly openLabel?: string | undefined;
};

/**
 * The inbox's card for one notification, in one compact anatomy: the face;
 * a column whose words wrap (and open the notification) — the title, led
 * by the accent unread dot while it waits on the person, then one caption
 * line saying when and what ("1h ago · Space invite"; on a phone, at the end
 * of the answers' row when the card has answers) — and, beneath on a
 * phone or beside the words on a desktop, the card's answers (the main answer as the solid pill, other choices as
 * outlines, an unavailable answer as its reason in a neutral tag) or, when
 * it waits on the person without answers of its own, one explicit Open
 * pill; and a quiet "…" menu holding Archive at the top trailing corner. A card
 * whose every answer is unavailable (a full space) is plainly inactive:
 * its words drop to the secondary ink and lose their unread dot and
 * weight. The words take the width left beside the fixed-size menu, so
 * a long title wraps instead of pushing a control off the edge.
 *
 * A card with no answers of its own is pressed by its `testID`; a card with
 * answers is addressed by `testID` and opened by `${testID}-open`.
 */
export function NotificationCardDefault(
  props: NotificationCardDefaultProps
): JSX.Element {
  const { t } = useLingui();
  const moderation = useModeration();
  // Copy as the reader may see it now (snapshot usernames moderated).
  const shown = createMemo(() =>
    displayNotification(moderation(), props.interaction)
  );
  const inline = createMemo((): readonly NotificationAction[] =>
    (props.showInlineActions ?? true) ? props.interaction.actions : []
  );
  const inactive = (): boolean => everyAnswerUnavailable(inline());
  const open = (): (() => void) | undefined => props.onPress ?? props.onOpen;
  // The id goes on what a driver presses: the words, unless the card has
  // answers of its own (then the words are `-open`) or cannot be opened.
  const idOnWords = (): boolean =>
    open() !== undefined && inline().length === 0;
  const wordsTestId = (): string | undefined => {
    if (props.testID === undefined || open() === undefined) return undefined;
    return idOnWords() ? props.testID : `${props.testID}-open`;
  };
  const openLabel = (): string | undefined =>
    props.interaction.category === 'action_required'
      ? (props.openLabel ?? t`Open`)
      : undefined;
  const state = (): ComponentDataSet | undefined =>
    props.testID === undefined
      ? undefined
      : cardState(props.interaction.isUnread);

  const mode = useLayoutMode();
  // A phone saves the card a line: when it has answers, when it came rides
  // at the end of their row instead of a caption line of its own.
  const metaOnAnswers = (): boolean =>
    mode() !== 'wide' && hasAnswerRow(inline(), openLabel(), open());
  const headline = (): JSX.Element => (
    <CardHeadline
      interaction={shown()}
      inactive={inactive()}
      showMeta={!metaOnAnswers()}
      onOpen={open()}
      testId={wordsTestId()}
      dataSet={idOnWords() ? state() : undefined}
    />
  );
  const menu = (): JSX.Element => (
    <CardMenu
      interaction={props.interaction}
      actions={props.actions}
      cardTestID={props.testID}
    />
  );
  const answers = (beside: boolean): JSX.Element => (
    <CardActionsRow
      interaction={props.interaction}
      actions={props.actions}
      inline={inline()}
      openLabel={openLabel()}
      onOpen={open()}
      actionTestID={props.actionTestID}
      beside={beside}
      trailing={
        <Show when={metaOnAnswers()}>
          <CardMeta interaction={shown()} />
        </Show>
      }
    />
  );

  return (
    <StackHorizontal
      align={mode() === 'wide' ? 'center' : 'start'}
      gap="md"
      paddingY="md"
      testId={idOnWords() ? undefined : props.testID}
      dataSet={idOnWords() ? undefined : state()}
    >
      {/* The unread dot lives in a fixed gutter before the face: a read
          card keeps the gutter empty, so faces and titles line up on every
          row of the feed. */}
      <StackVertical paddingTop="md">
        <Show
          when={shown().isUnread && !inactive()}
          fallback={<StatusDot color="transparent" size={UNREAD_DOT_SIZE} />}
        >
          <StatusDot
            status="unread"
            size={UNREAD_DOT_SIZE}
            label={t`Unread`}
            dataSet={{ 'inbox-unread': 'true' }}
          />
        </Show>
      </StackVertical>
      {props.leading ?? <DefaultLeading interaction={shown()} />}
      {/* A desktop's feed is short and wide enough for the answers beside
          the words, the "…" after them; a phone stacks the answers under
          the words and the "…" beside the title, so the answers' row (with
          when the card came) runs under both. */}
      <Show
        when={mode() === 'wide'}
        fallback={
          <StackVertical grow shrink gap="sm">
            <StackHorizontal align="start" gap="md">
              {headline()}
              {menu()}
            </StackHorizontal>
            {answers(false)}
          </StackVertical>
        }
      >
        <StackVertical grow shrink>
          {headline()}
        </StackVertical>
        {answers(true)}
        {menu()}
      </Show>
    </StackHorizontal>
  );
}
