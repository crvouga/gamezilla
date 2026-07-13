import { SpaceJoinBlockedNote } from './space-join-blocked-note';
import { SpaceJoinButton } from './space-join-button';
import { useSpaceJoinSnapshot } from './use-space-join-snapshot';
import { SpaceGuestSection } from '../members/space-guest-section';
import { SpaceTitleText } from '../space-title-text';
import {
  SPACE_CARD_BORDER_RADIUS,
  SpaceCardGradientBox,
} from '../card/space-card-gradient';
import { SpaceSummaryHeader } from '../card/space-summary-header';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import {
  Box,
  EmptyState,
  Gamepad2Icon,
  LoadingState,
  ScreenBase,
  Text,
} from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceJoinPromptProps = {
  spaceId: string;
};

export function SpaceJoinPrompt({ spaceId }: SpaceJoinPromptProps): ReactNode {
  const nav = useBreadcrumbNav();
  const snapshot = useSpaceJoinSnapshot(spaceId);

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        {
          name: (
            <SpaceTitleText spaceId={spaceId} variant="navigationTitle" />
          ),
        },
      ]}
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

  return (
    <Box sx={{ gap: 4 }}>
      <SpaceCardGradientBox
        sx={{
          borderRadius: SPACE_CARD_BORDER_RADIUS,
          p: 4,
          minHeight: 112,
          justifyContent: 'space-between',
          gap: 0,
        }}
      >
        <SpaceSummaryHeader spaceId={spaceId} />
        <SpaceGuestSection spaceId={spaceId} />
      </SpaceCardGradientBox>
      <Text
        variant="body"
        sx={{ color: 'textSecondary' }}
        label={
          snapshot.status === 'ended' ? (
            <Trans>This space has ended.</Trans>
          ) : (
            <Trans>Join to see who is here and hang out.</Trans>
          )
        }
      />
      {snapshot.status === 'live' ? (
        <>
          <SpaceJoinBlockedNote spaceId={spaceId} />
          <SpaceJoinButton spaceId={spaceId} joinable={snapshot.joinable} />
        </>
      ) : null}
    </Box>
  );
}
