import { Trans, useLingui } from '@lingui/solid/macro';
import {
  EmptyState,
  Gamepad2Icon,
  LoadingState,
  ScreenBase,
  useBreadcrumbNav,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Match, Show, Switch } from 'solid-js';
import { SpaceTitleText } from '../../../root/client/space-title-text';
import { SpaceEndedScreen } from './space-ended-screen';
import { SpaceJoinButton } from './space-join-button';
import { SpaceJoinLiveBody } from './space-join-live-body';
import { useSpaceJoinSnapshot } from './use-space-join-snapshot';

export type SpaceJoinPromptProps = {
  spaceId: string;
};

export function SpaceJoinPrompt(props: SpaceJoinPromptProps): JSX.Element {
  const nav = useBreadcrumbNav();
  const snapshot = useSpaceJoinSnapshot(() => props.spaceId);

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
              />
            </div>
          </Show>
        }
        content={({ bodyClass }) => (
          <div class={`box ${bodyClass}`}>
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
      <Match when={props.snapshot().status === 'live'}>
        <SpaceJoinLiveBody spaceId={props.spaceId} />
      </Match>
    </Switch>
  );
}
