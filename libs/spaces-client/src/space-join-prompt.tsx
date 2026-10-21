import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { ContentScreen } from '@pkgs/ui-root-client/content-screen';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { Gamepad2Icon } from '@pkgs/ui-root-client/icons';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client/stack';
import { useBreadcrumbNav } from '@pkgs/ui-root-client/use-breadcrumb-nav';
import type { JSX } from 'solid-js';
import { createSignal, Match, Show, Switch } from 'solid-js';
import { useRequestLeaveSpace } from './leave-space-modal-provider';
import { SpaceHostOfflineNotice } from './space-connection-notice';
import { SpaceEndedScreen } from './space-ended-screen';
import { SpaceJoinButton } from './space-join-button';
import { SpaceJoinLiveBody } from './space-join-live-body';
import { SpaceTitleText } from './space-title-text';
import { SpacesNeedConnectionNotice } from './spaces-notices';
import { useSpaceCan } from './use-space-can';
import { useSpaceHostConnection } from './use-space-host-connection';
import { useSpaceJoinSnapshot } from './use-space-join-snapshot';

export type SpaceJoinPromptProps = {
  spaceId: string;
  /** The server has answered for this link (see `useSpaceByLink`). */
  linkAnswered: boolean;
};

export function SpaceJoinPrompt(props: SpaceJoinPromptProps): JSX.Element {
  const nav = useBreadcrumbNav();
  const snapshot = useSpaceJoinSnapshot(
    () => props.spaceId,
    () => props.linkAnswered
  );
  const [joinOffline, setJoinOffline] = createSignal(false);
  const connection = useSpaceHostConnection();

  return (
    <Show
      when={snapshot().status !== 'ended'}
      fallback={<SpaceEndedScreen spaceId={props.spaceId} />}
    >
      <ContentScreen
        screenId="space-join"
        dataSet={{ testid: Handles.spaceJoinPrompt }}
        breadcrumbs={[
          { name: <Trans>Spaces</Trans>, onClick: nav('/') },
          { name: <SpaceTitleText spaceId={props.spaceId} /> },
        ]}
        footer={
          <Show
            when={snapshot().status === 'live' && connection() !== 'loading'}
          >
            <JoinPromptFooter
              spaceId={props.spaceId}
              hostOffline={connection() === 'host-offline'}
              joinable={snapshot().joinable}
              onOffline={() => setJoinOffline(true)}
            />
          </Show>
        }
      >
        <StackVertical grow gap="md">
          <Show when={joinOffline() || connection() === 'offline'}>
            <SpacesNeedConnectionNotice />
          </Show>
          <Show
            when={
              snapshot().status === 'live' && connection() === 'host-offline'
            }
            fallback={
              <JoinPromptBody spaceId={props.spaceId} snapshot={snapshot} />
            }
          >
            <SpaceHostOfflineNotice />
          </Show>
        </StackVertical>
      </ContentScreen>
    </Show>
  );
}

function JoinPromptFooter(props: {
  readonly spaceId: string;
  readonly hostOffline: boolean;
  readonly joinable: boolean;
  readonly onOffline: () => void;
}): JSX.Element {
  const canLeave = useSpaceCan(() => props.spaceId, PERMISSION.spacesLeave);
  const requestLeave = useRequestLeaveSpace();
  return (
    <StackHorizontal>
      <Show
        when={props.hostOffline}
        fallback={
          <SpaceJoinButton
            spaceId={props.spaceId}
            joinable={props.joinable}
            flex={1}
            onOffline={props.onOffline}
          />
        }
      >
        <Show when={canLeave()}>
          <Button
            title={<Trans>Leave space</Trans>}
            intent="neutral"
            variant="outline"
            flex={1}
            dataSet={{ testid: Handles.spaceLeave }}
            onClick={() => requestLeave(props.spaceId)}
          />
        </Show>
      </Show>
    </StackHorizontal>
  );
}

function JoinPromptBody(props: {
  readonly spaceId: string;
  readonly snapshot: ReturnType<typeof useSpaceJoinSnapshot>;
}): JSX.Element {
  const nav = useBreadcrumbNav();
  const { t } = useLingui();

  return (
    <Switch>
      <Match when={props.snapshot().status === 'loading'}>
        <LoadingState />
      </Match>
      <Match when={props.snapshot().status === 'unavailable'}>
        <EmptyState
          icon={Gamepad2Icon}
          title={t`Space not available`}
          body={t`Ask the host to add you to the allow list, or check the link.`}
          action={{
            label: t`Back to spaces`,
            onClick: nav('/'),
          }}
        />
      </Match>
      <Match when={props.snapshot().status === 'missing'}>
        <EmptyState
          icon={Gamepad2Icon}
          title={t`This space can't be found`}
          body={t`The link may be wrong, or the space may never have existed.`}
          action={{
            label: t`Back to Spaces`,
            onClick: nav('/'),
          }}
          dataSet={{ testid: Handles.spaceNotFound }}
        />
      </Match>
      <Match when={props.snapshot().status === 'offline'}>
        <SpacesNeedConnectionNotice />
      </Match>
      <Match when={props.snapshot().status === 'live'}>
        <SpaceJoinLiveBody spaceId={props.spaceId} />
      </Match>
    </Switch>
  );
}
