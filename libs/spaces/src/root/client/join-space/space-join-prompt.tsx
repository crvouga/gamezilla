import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  EmptyState,
  Gamepad2Icon,
  LoadingState,
  ScreenBase,
} from '@pkgs/ui-rn';
import { useBreadcrumbNav } from '@pkgs/ui-rn/components/use-breadcrumb-nav';
import type { ReactNode } from 'react';
import { SpaceTitleText } from '../../../root/client/space-title-text';
import { SpaceEndedScreen } from './space-ended-screen';
import { SpaceJoinButton } from './space-join-button';
import { SpaceJoinLiveBody } from './space-join-live-body';
import { useSpaceJoinSnapshot } from './use-space-join-snapshot';

export type SpaceJoinPromptProps = {
  spaceId: string;
};

export function SpaceJoinPrompt({ spaceId }: SpaceJoinPromptProps): ReactNode {
  const nav = useBreadcrumbNav();
  const snapshot = useSpaceJoinSnapshot(spaceId);

  if (snapshot.status === 'ended') {
    return <SpaceEndedScreen spaceId={spaceId} />;
  }

  return (
    <ScreenBase
      screenId="space-join"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        {
          name: <SpaceTitleText spaceId={spaceId} variant="navigationTitle" />,
        },
      ]}
      footer={
        snapshot.status === 'live' ? (
          <Box sx={{ flexDirection: 'row' }}>
            <SpaceJoinButton
              spaceId={spaceId}
              joinable={snapshot.joinable}
              flex={1}
            />
          </Box>
        ) : undefined
      }
      content={({ sx }) => (
        <Box sx={sx}>
          <JoinPromptBody spaceId={spaceId} snapshot={snapshot} />
        </Box>
      )}
    />
  );
}

function JoinPromptBody({
  spaceId,
  snapshot,
}: {
  spaceId: string;
  snapshot: ReturnType<typeof useSpaceJoinSnapshot>;
}): ReactNode {
  const nav = useBreadcrumbNav();
  const { t } = useLingui();

  if (snapshot.status === 'loading') {
    return <LoadingState />;
  }
  if (snapshot.status === 'unavailable') {
    return (
      <EmptyState
        icon={Gamepad2Icon}
        title={t`Space not available`}
        body={t`Ask the host to add you to the allow list, or check the link.`}
        action={{
          label: t`Back to spaces`,
          onPress: nav('/'),
        }}
      />
    );
  }
  return <SpaceJoinLiveBody spaceId={spaceId} />;
}
