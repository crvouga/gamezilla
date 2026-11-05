import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { StatusDot } from '@pkgs/ui-root-client-ts/status-dot';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { openSpaceDetail } from './space-routes';
import { useFriendLiveSpace } from './use-friend-live-space';
import { useLiveSpaceTitles } from './use-live-space-titles';
import { useIsSpaceOpenLocally } from './use-open-space-session-ids';

const STATUS_DOT_SIZE = 8;

/** The live space a friend is in, as their status line names it. */
export type FriendLiveSpaceSummary = {
  readonly hosting: boolean;
  /** The space's own name, when it has one (not the "<host>'s space" default). */
  readonly title?: string | null | undefined;
};

/** "Hosting Friday game night", "In a space": what the friend is doing. */
function FriendLiveSpaceWhat(props: FriendLiveSpaceSummary): JSX.Element {
  const { t } = useLingui();
  return (
    <Show
      when={props.title}
      fallback={
        <Show when={props.hosting} fallback={<Trans>In a space</Trans>}>
          <Trans>Hosting a space</Trans>
        </Show>
      }
    >
      {(title) => (
        <Show when={props.hosting} fallback={t`In ${title()}`}>
          {t`Hosting ${title()}`}
        </Show>
      )}
    </Show>
  );
}

/**
 * What a friend is doing in a live space, under their name: the room by its
 * name when it has one ("Hosting Friday game night"), with the online dot
 * (words and color together).
 */
export function FriendLiveSpaceStatusView(
  props: FriendLiveSpaceSummary
): JSX.Element {
  return (
    <StackHorizontal align="center" gap="xs">
      <StatusDot status="online" size={STATUS_DOT_SIZE} />
      <P variant="caption" lines={1}>
        <FriendLiveSpaceWhat {...props} />
      </P>
    </StackHorizontal>
  );
}

/** What pressing a friend's live space does: go in, or back in. */
export type FriendLiveSpaceAction = 'join' | 'open';

/**
 * The way into a friend's live space at the row's end: "Join", or "Open"
 * when this device already has it open, the lobby's words for the same
 * two actions. A small outlined pill, like every
 * row's one control.
 */
export function FriendLiveSpaceJoinView(props: {
  readonly action: FriendLiveSpaceAction;
  readonly onPress: () => void;
  /**
   * The friend's account id, for the control's handle: set on the friends
   * list, the one place a driver looks for it.
   */
  readonly hostAccountId?: string | undefined;
}): JSX.Element {
  return (
    <Button
      title={
        <Show when={props.action === 'open'} fallback={<Trans>Join</Trans>}>
          <Trans>Open</Trans>
        </Show>
      }
      intent="neutral"
      variant="outline"
      size="sm"
      onClick={() => props.onPress()}
      dataSet={
        props.hostAccountId === undefined
          ? undefined
          : { testid: Handles.friendLiveSpace(props.hostAccountId) }
      }
    />
  );
}

/** A friend's live-space status, while they are in a live space. */
export function FriendLiveSpaceStatus(props: {
  readonly hostAccountId: string;
}): JSX.Element {
  const live = useFriendLiveSpace(() => props.hostAccountId);
  return (
    <Show when={live()?.spaceId} keyed>
      {(spaceId) => (
        <FriendLiveSpaceStatusFor
          spaceId={spaceId}
          hosting={live()?.hosting ?? false}
        />
      )}
    </Show>
  );
}

function FriendLiveSpaceStatusFor(props: {
  readonly spaceId: string;
  readonly hosting: boolean;
}): JSX.Element {
  const titles = useLiveSpaceTitles();
  return (
    <FriendLiveSpaceStatusView
      hosting={props.hosting}
      title={titles().get(props.spaceId) ?? null}
    />
  );
}

function FriendLiveSpaceJoinFor(props: {
  readonly spaceId: string;
  readonly hostAccountId: string;
}): JSX.Element {
  const router = useRouter();
  const isOpen = useIsSpaceOpenLocally(props.spaceId);
  return (
    <FriendLiveSpaceJoinView
      action={isOpen() ? 'open' : 'join'}
      onPress={() => openSpaceDetail(router, props.spaceId)}
      hostAccountId={props.hostAccountId}
    />
  );
}

/**
 * Join (or Open) a friend's live space, while they are in one; otherwise
 * the `fallback`, such as the row's chevron.
 */
export function FriendLiveSpaceJoin(props: {
  readonly hostAccountId: string;
  readonly fallback?: JSX.Element;
}): JSX.Element {
  const live = useFriendLiveSpace(() => props.hostAccountId);
  return (
    <Show when={live()?.spaceId} keyed fallback={props.fallback}>
      {(spaceId) => (
        <FriendLiveSpaceJoinFor
          spaceId={spaceId}
          hostAccountId={props.hostAccountId}
        />
      )}
    </Show>
  );
}
