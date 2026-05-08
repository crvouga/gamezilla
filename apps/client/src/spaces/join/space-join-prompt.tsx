import { SpaceBackButton } from '@gamezilla/client/spaces/join/space-back-button';
import { SpaceJoinBlockedNote } from '@gamezilla/client/spaces/join/space-join-blocked-note';
import { SpaceJoinButton } from '@gamezilla/client/spaces/join/space-join-button';
import { SpaceJoinHostSection } from '@gamezilla/client/spaces/join/space-join-host-section';
import { SpaceTitleText } from '@gamezilla/client/spaces/host/space-title-text';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import {
  Box,
  Card,
  ScreenBase,
  Text,
  type ScreenBaseAction,
} from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, type ReactNode } from 'react';

export type SpaceJoinPromptProps = {
  spaceId: string;
  onOpenDebug: () => void;
};

const JOIN_MAX_WIDTH = 480;

/** Pure layout for the not-yet-joined state of the space detail screen. */
export function SpaceJoinPrompt({
  spaceId,
  onOpenDebug,
}: SpaceJoinPromptProps): ReactNode {
  const { t } = useLingui();
  const nav = useBreadcrumbNav();
  const actions = useMemo<ScreenBaseAction[]>(
    () => [
      {
        type: 'default',
        label: t`Debug`,
        icon: 'chevron.left.forwardslash.chevron.right',
        onPress: onOpenDebug,
        overflow: 'auto',
      },
    ],
    [onOpenDebug, t]
  );

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <SpaceTitleText spaceId={spaceId} variant="bodyBold" /> },
      ]}
      actions={actions}
      content={({ sx }) => (
        <Box style={sx}>
          <Box
            sx={{
              alignSelf: 'center',
              maxWidth: JOIN_MAX_WIDTH,
              gap: 4,
            }}
            style={{ width: '100%' }}
          >
            <Card elevation={0} sx={{ p: 4, gap: 3 }}>
              <SpaceJoinHostSection spaceId={spaceId} />
              <Text
                variant="body"
                sx={{ color: 'textSecondary' }}
                label={
                  <Trans>
                    Join this space to see who is here and hang out.
                  </Trans>
                }
              />
              <SpaceJoinBlockedNote spaceId={spaceId} />
            </Card>
            <Box sx={{ gap: 2 }}>
              <SpaceJoinButton spaceId={spaceId} />
              <SpaceBackButton />
            </Box>
          </Box>
        </Box>
      )}
    />
  );
}
