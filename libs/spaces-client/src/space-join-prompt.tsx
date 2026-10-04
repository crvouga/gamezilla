import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-client/empty-state';
import { Gamepad2Icon } from '@pkgs/ui-client/icons';
import { LoadingState } from '@pkgs/ui-client/loading-state';
import { ScreenBase } from '@pkgs/ui-client/screen-base';
import { useBreadcrumbNav } from '@pkgs/ui-client/use-breadcrumb-nav';
import type { JSX } from 'solid-js';
import { createSignal, Match, Show, Switch } from 'solid-js';
import { SpaceTitleText } from './space-title-text';
import { SpacesNeedConnectionNotice } from './spaces-notices';
import { SpaceEndedScreen } from './space-ended-screen';
import { SpaceJoinButton } from './space-join-button';
import { SpaceJoinLiveBody } from './space-join-live-body';
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

  return (
    <Show
      when={snapshot().status !== 'ended'}
      fallback={<SpaceEndedScreen spaceId={props.spaceId} />}
    >
      <ScreenBase
        screenId="space-join"
        breadcrumbs={[
          { name: <Trans>Spaces</Trans>, onClick: nav('/') },
          {
            name: (
              <SpaceTitleText
                spaceId={props.spaceId}
                variant="navigationTitle"
              />
            ),
          },
        ]}
        footer={
          <Show when={snapshot().status === 'live'}>
            <div class="box flex-row">
              <SpaceJoinButton
                spaceId={props.spaceId}
                joinable={snapshot().joinable}
                flex={1}
                onOffline={() => setJoinOffline(true)}
              />
            </div>
          </Show>
        }
        content={({ bodyClass }) => (
          <div class={`box gap-3 ${bodyClass}`}>
            <Show when={joinOffline()}>
              <SpacesNeedConnectionNotice />
            </Show>
            <JoinPromptBody spaceId={props.spaceId} snapshot={snapshot} />
          </div>
        )}
      />
    </Show>
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
