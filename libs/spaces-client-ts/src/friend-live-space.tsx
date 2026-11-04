import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { StatusDot } from '@pkgs/ui-root-client-ts/status-dot';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { openSpaceDetail } from './space-routes';
import { useFriendLiveSpace } from './use-friend-live-space';
import { useIsSpaceOpenLocally } from './use-open-space-session-ids';

const STATUS_DOT_SIZE = 8;

/**
 * What a friend is doing in a live space, under their name: "Hosting a
 * space" or "In a space", with the online dot (words and color together).
 */
export function FriendLiveSpaceStatusView(props: {
  readonly hosting: boolean;
}): JSX.Element {
  return (
    <StackHorizontal align="center" gap="xs">
      <StatusDot status="online" size={STATUS_DOT_SIZE} />
      <P variant="caption" lines={1}>
        <Show when={props.hosting} fallback={<Trans>In a space</Trans>}>
          <Trans>Hosting a space</Trans>
        </Show>
      </P>
    </StackHorizontal>
  );
}

/** What pressing a friend's live space does: go in, or back in. */
export type FriendLiveSpaceAction = 'join' | 'resume';

/**
 * The way into a friend's live space at the row's end: "Join", or "Resume"
 * when this device already has it open. A small outlined pill, like every
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
        <Show when={props.action === 'resume'} fallback={<Trans>Join</Trans>}>
          <Trans>Resume</Trans>
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
    <Show when={live()}>
      {(space) => <FriendLiveSpaceStatusView hosting={space().hosting} />}
    </Show>
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
      action={isOpen() ? 'resume' : 'join'}
      onPress={() => openSpaceDetail(router, props.spaceId)}
      hostAccountId={props.hostAccountId}
    />
  );
}

/**
 * Join (or Resume) a friend's live space, while they are in one; otherwise
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
