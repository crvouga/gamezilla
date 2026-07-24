import { SpaceJoinButton } from './space-join-button';
import { SpaceEndedScreen } from './space-ended-screen';
import { SpaceJoinLiveBody } from './space-join-live-body';
import { useSpaceJoinSnapshot } from './use-space-join-snapshot';
import { SpaceTitleText } from '../space-title-text';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import {
  Box,
  EmptyState,
  Gamepad2Icon,
  LoadingState,
  ScreenBase,
} from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';

export type SpaceJoinPromptProps = {
  spaceId: string;
};

function useInviteTokenParam(): string | null {
  const params = useLocalSearchParams<{ invite?: string | string[] }>();
  const raw = params.invite;
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === 'string' && entry.length > 0) return entry;
    }
  }
  return null;
}

export function SpaceJoinPrompt({ spaceId }: SpaceJoinPromptProps): ReactNode {
  const nav = useBreadcrumbNav();
  const inviteToken = useInviteTokenParam();
  const snapshot = useSpaceJoinSnapshot(spaceId, inviteToken);

  if (snapshot.status === 'ended') {
    return <SpaceEndedScreen spaceId={spaceId} />;
  }

  return (
    <ScreenBase
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
              inviteToken={inviteToken}
              flex={1}
            />
          </Box>
        ) : undefined
      }
      content={({ sx }) => (
        <Box style={sx}>
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
    return <LoadingState size="large" />;
  }

  if (snapshot.status === 'unavailable') {
    return (
      <EmptyState
        icon={Gamepad2Icon}
        title={<Trans>This space is not available</Trans>}
        body={<Trans>It may have ended or the link might be invalid.</Trans>}
        action={{ label: t`Back to Spaces`, onPress: nav('/') }}
      />
    );
  }

  return <SpaceJoinLiveBody spaceId={spaceId} />;
}
