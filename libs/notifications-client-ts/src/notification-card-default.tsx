/** @jsxImportSource solid-js */

import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import type { Notification } from '@libs/notifications-shared-ts/notification';
import type {
  NotificationAction,
  NotificationCardActions,
} from '@libs/notifications-shared-ts/notification-action';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Avatar, avatarInitials } from '@pkgs/ui-root-client-ts/avatar';
import { InfoIcon } from '@pkgs/ui-root-client-ts/icons';
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
const STATUS_ICON_SIZE = 16;

/** What a person can see: still waiting to be opened, or already opened. */
function cardState(unread: boolean): ComponentDataSet {
  return { 'inbox-state': unread ? 'waiting' : 'opened' };
}

function DefaultLeading(props: {
  readonly interaction: Notification;
}): JSX.Element {
  return (
    <Show
      when={props.interaction.avatar?.fallbackLabel}
      keyed
      fallback={<Avatar size={LEADING_SIZE} />}
    >
      {(label) => (
        <Avatar
          size={LEADING_SIZE}
          initials={avatarInitials(label)}
          tintKey={label.replace(/^@/, '')}
        />
      )}
    </Show>
  );
}

function InteractionRowText(props: {
  readonly interaction: Notification;
}): JSX.Element {
  const relative = useRelativeTimeLabel(() => props.interaction.createdAt);
  const detailParts = createMemo(() =>
    [props.interaction.subtitle, props.interaction.body].filter(
      (part): part is string => part !== undefined && part.length > 0
    )
  );
  return (
    <StackVertical grow gap="xs">
      <P variant={props.interaction.isUnread ? 'bodyBold' : 'body'} lines={3}>
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
  readonly onOpen: (() => void) | undefined;
  readonly testId: string | undefined;
  readonly dataSet: ComponentDataSet | undefined;
}): JSX.Element {
  return (
    <Show
      when={props.onOpen}
      keyed
      fallback={<InteractionRowText interaction={props.interaction} />}
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
          <InteractionRowText interaction={props.interaction} />
        </Pressable>
      )}
    </Show>
  );
}

/**
 * Why an answer cannot be given right now ("Space is full"), told as a
 * plain status line in the answer's place: an icon and muted words, with
 * no pill or outline, so it never reads as a button that does nothing.
 */
function UnavailableAnswer(props: { readonly reason: string }): JSX.Element {
  return (
    <StackHorizontal align="center" gap="xs">
      <InfoIcon size={STATUS_ICON_SIZE} color="textSecondary" />
      <P variant="caption">{props.reason}</P>
    </StackHorizontal>
  );
}

/**
 * The card's answers on their own row under its words: the main answer
 * first, other choices beside it. An answer that is unavailable for a
 * stated reason shows that reason instead. Nothing is drawn when the card
 * has no answers, so such a card stays one compact block.
 */
function CardActionsRow(props: {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
  readonly inline: readonly NotificationAction[];
  readonly actionTestID?:
    | ((action: NotificationAction) => string | undefined)
    | undefined;
}): JSX.Element {
  const primaryId = createMemo(() => primaryNotificationActionId(props.inline));
  return (
    <Show when={props.inline.length > 0}>
      <StackHorizontal align="center" gap="sm" wrap>
        <For each={props.inline}>
          {(action) => (
            <Show
              when={
                action.disabled === true ? action.disabledReason : undefined
              }
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
      </StackHorizontal>
    </Show>
  );
}

/** Archive, in the card's trailing corner beside its words. */
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
};

/**
 * The inbox's card for one notification, in one anatomy: the face, then a
 * column whose words wrap (and open the notification), with Archive as a
 * quiet icon button in the trailing corner beside them, and the card's own
 * answers on a row beneath — the main answer as the solid pill, other
 * choices as outlines, an unavailable answer as its reason. A card without
 * answers is one compact block. Only the small Archive button sits beside
 * the words, so a long title never pushes a control off the edge.
 *
 * A card with no answers of its own is pressed by its `testID`; a card with
 * answers is addressed by `testID` and opened by `${testID}-open`.
 */
export function NotificationCardDefault(
  props: NotificationCardDefaultProps
): JSX.Element {
  const moderation = useModeration();
  // Copy as the reader may see it now (snapshot usernames moderated).
  const shown = createMemo(() =>
    displayNotification(moderation(), props.interaction)
  );
  const inline = createMemo((): readonly NotificationAction[] =>
    (props.showInlineActions ?? true) ? props.interaction.actions : []
  );
  const open = (): (() => void) | undefined => props.onPress ?? props.onOpen;
  // The id goes on what a driver presses: the words, unless the card has
  // answers of its own (then the words are `-open`) or cannot be opened.
  const idOnWords = (): boolean =>
    open() !== undefined && inline().length === 0;
  const wordsTestId = (): string | undefined => {
    if (props.testID === undefined || open() === undefined) return undefined;
    return idOnWords() ? props.testID : `${props.testID}-open`;
  };
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
        <StackHorizontal align="start" gap="xs">
          <CardHeadline
            interaction={shown()}
            onOpen={open()}
            testId={wordsTestId()}
            dataSet={idOnWords() ? state() : undefined}
          />
          <CardArchive
            interaction={props.interaction}
            actions={props.actions}
            cardTestID={props.testID}
          />
        </StackHorizontal>
        <CardActionsRow
          interaction={props.interaction}
          actions={props.actions}
          inline={inline()}
          actionTestID={props.actionTestID}
        />
      </StackVertical>
    </StackHorizontal>
  );
}
