/** @jsxImportSource solid-js */

import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import type { Notification } from '@libs/notifications-shared-ts/notification';
import type {
  NotificationAction,
  NotificationCardActions,
} from '@libs/notifications-shared-ts/notification-action';
import { DeviceAvatar } from '@libs/profile-client-ts/device-avatar';
import { parseAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { useRelativeTimeLabel } from '@pkgs/ui-root-client-ts/relative-time';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, For, type JSX, Show } from 'solid-js';

import { InboxArchiveButton } from './inbox-archive-button';
import {
  NotificationActionButton,
  primaryNotificationActionId,
} from './notification-action-button';
import { displayNotification } from './notification-display';

/** The default face: `md`, so every card's text column starts at one x. */
const LEADING_SIZE = 40;

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

function InteractionRowText(props: {
  readonly interaction: Notification;
  /** Nothing can be answered any more: the words step back. */
  readonly inactive: boolean;
}): JSX.Element {
  const relative = useRelativeTimeLabel(() => props.interaction.createdAt);
  const detailParts = createMemo(() =>
    [props.interaction.subtitle, props.interaction.body].filter(
      (part): part is string => part !== undefined && part.length > 0
    )
  );
  return (
    <StackVertical grow gap="xs">
      <P
        variant={
          props.interaction.isUnread && !props.inactive ? 'bodyBold' : 'body'
        }
        tone={props.inactive ? 'secondary' : undefined}
        lines={3}
      >
        {props.interaction.title}
      </P>
      <P variant="caption">{relative()}</P>
      <For each={detailParts()}>
        {(part) => (
          <P variant="caption" lines={2}>
            {part}
          </P>
        )}
      </For>
    </StackVertical>
  );
}

/** The words of the card; pressing them opens it (the whole block takes the press tint). */
function CardHeadline(props: {
  readonly interaction: Notification;
  readonly inactive: boolean;
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
  const primaryId = createMemo(() => primaryNotificationActionId(props.inline));
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
 * pressing its words does, said as a solid pill so the card reads as
 * actionable at a glance.
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
            <Button title={label} size="sm" intent="primary" onClick={open} />
          )}
        </Show>
      )}
    </Show>
  );
}

/** Archive, at the trailing end of the card's action row. */
function CardArchive(props: {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
  readonly cardTestID: string | undefined;
}): JSX.Element {
  return (
    <Show when={props.cardTestID} keyed>
      {(cardTestID) => (
        <InboxArchiveButton
          testId={Handles.notificationsArchive(cardTestID)}
          onArchive={() => {
            void props.actions.archive(props.interaction.id);
          }}
        />
      )}
    </Show>
  );
}

/**
 * The card's action row under its words: its answers first (the main one
 * as the solid pill, other choices as outlines, an unavailable one as its
 * reason in a neutral tag), or its one explicit open step, then Archive as
 * a quiet labelled ghost button at the trailing end. Nothing is drawn when
 * the card has neither answers nor Archive, so it stays one compact block.
 */
function CardActionsRow(props: {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
  readonly inline: readonly NotificationAction[];
  readonly openLabel: string | undefined;
  readonly onOpen: (() => void) | undefined;
  readonly cardTestID: string | undefined;
  readonly actionTestID?:
    | ((action: NotificationAction) => string | undefined)
    | undefined;
}): JSX.Element {
  const openStep = (): string | undefined =>
    props.inline.length === 0 ? props.openLabel : undefined;
  const hasRow = (): boolean =>
    props.inline.length > 0 ||
    (openStep() !== undefined && props.onOpen !== undefined) ||
    props.cardTestID !== undefined;
  return (
    <Show when={hasRow()}>
      <StackHorizontal align="center" justify="between" gap="sm">
        <StackHorizontal align="center" gap="sm" wrap>
          <CardAnswers
            interaction={props.interaction}
            actions={props.actions}
            inline={props.inline}
            actionTestID={props.actionTestID}
          />
          <CardOpenAnswer label={openStep()} onOpen={props.onOpen} />
        </StackHorizontal>
        <CardArchive
          interaction={props.interaction}
          actions={props.actions}
          cardTestID={props.cardTestID}
        />
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
  /** Addresses the card; also gives it the Archive action. */
  readonly testID?: string | undefined;
  /**
   * The explicit next step's label on a card that waits on the person but
   * shows no answers ("Respond"). Defaults to "Open" for such a card.
   */
  readonly openLabel?: string | undefined;
};

/**
 * The inbox's card for one notification, in one anatomy: the face, then a
 * column whose words wrap (and open the notification), and an action row
 * beneath — the card's answers first (the main answer as the solid pill,
 * other choices as outlines, an unavailable answer as its reason in a
 * neutral tag), or, when it waits on the person without answers of its own,
 * one explicit Open pill; then Archive as a quiet labelled ghost button at
 * the row's trailing end. A card whose every answer is unavailable (a full
 * space) is plainly inactive: its words drop to the secondary ink and lose
 * their unread weight. Nothing sits beside the words, so a long title never
 * pushes a control off the edge.
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

  return (
    <StackHorizontal
      align="start"
      gap="md"
      paddingY="lg"
      testId={idOnWords() ? undefined : props.testID}
      dataSet={idOnWords() ? undefined : state()}
    >
      {props.leading ?? <DefaultLeading interaction={shown()} />}
      <StackVertical grow gap="md">
        <CardHeadline
          interaction={shown()}
          inactive={inactive()}
          onOpen={open()}
          testId={wordsTestId()}
          dataSet={idOnWords() ? state() : undefined}
        />
        <CardActionsRow
          interaction={props.interaction}
          actions={props.actions}
          inline={inline()}
          openLabel={openLabel()}
          onOpen={open()}
          cardTestID={props.testID}
          actionTestID={props.actionTestID}
        />
      </StackVertical>
    </StackHorizontal>
  );
}
