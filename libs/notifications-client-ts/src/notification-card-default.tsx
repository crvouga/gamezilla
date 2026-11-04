/** @jsxImportSource solid-js */

import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import type { Notification } from '@libs/notifications-shared-ts/notification';
import type {
  NotificationAction,
  NotificationCardActions,
} from '@libs/notifications-shared-ts/notification-action';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Avatar, avatarInitials } from '@pkgs/ui-root-client-ts/avatar';
import { ChevronRightIcon } from '@pkgs/ui-root-client-ts/icons';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { useRelativeTimeLabel } from '@pkgs/ui-root-client-ts/relative-time';
import { Spacer } from '@pkgs/ui-root-client-ts/spacer';
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

/** The words of the card; pressing them opens it, with a chevron to say so. */
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
          gap="sm"
          radius="control"
          onPress={open}
          testId={props.testId}
          dataSet={props.dataSet}
        >
          <InteractionRowText interaction={props.interaction} />
          <ChevronRightIcon size={20} color="icon" />
        </Pressable>
      )}
    </Show>
  );
}

/**
 * The card's answers on their own row under its words: the main answer
 * first, other choices beside it, and Archive always at the far end.
 */
function CardActionsRow(props: {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
  readonly inline: readonly NotificationAction[];
  readonly actionTestID?:
    | ((action: NotificationAction) => string | undefined)
    | undefined;
  readonly archiveTestID: string | undefined;
}): JSX.Element {
  const primaryId = createMemo(() => primaryNotificationActionId(props.inline));
  return (
    <Show when={props.inline.length > 0 || props.archiveTestID !== undefined}>
      <StackHorizontal align="center" gap="sm" wrap>
        <For each={props.inline}>
          {(action) => (
            <NotificationActionButton
              interaction={props.interaction}
              action={action}
              actions={props.actions}
              emphasis={action.id === primaryId() ? 'primary' : 'secondary'}
              testID={props.actionTestID?.(action)}
            />
          )}
        </For>
        <Show when={props.archiveTestID} keyed>
          {(cardTestID) => (
            <>
              <Spacer />
              <InboxArchiveButton
                testId={Handles.notificationsArchive(cardTestID)}
                onArchive={() => {
                  void props.actions.archive(props.interaction.id);
                }}
              />
            </>
          )}
        </Show>
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
};

/**
 * The inbox's card for one notification, in one anatomy: the face, then a
 * column whose words wrap (and open the notification, ending in a chevron),
 * with the card's answers on their own row beneath — the main answer as the
 * solid pill, other choices as outlines, Archive always at the far end. On a
 * phone nothing sits beside the words, so a long title never pushes a
 * control off the edge.
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
        <CardHeadline
          interaction={shown()}
          onOpen={open()}
          testId={wordsTestId()}
          dataSet={idOnWords() ? state() : undefined}
        />
        <CardActionsRow
          interaction={props.interaction}
          actions={props.actions}
          inline={inline()}
          actionTestID={props.actionTestID}
          archiveTestID={props.testID}
        />
      </StackVertical>
    </StackHorizontal>
  );
}
