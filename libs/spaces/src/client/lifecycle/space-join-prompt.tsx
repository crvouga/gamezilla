import { SpaceJoinBlockedNote } from './space-join-blocked-note';
import { SpaceJoinButton } from './space-join-button';
import { SpaceJoinHostSection } from './space-join-host-section';
import { SpaceTitleText } from '../space-title-text';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { Box, Card, ScreenBase, Text, type ScreenBaseAction } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, type ReactNode } from 'react';

export type SpaceJoinPromptProps = {
  spaceId: string;
  onOpenDebug: () => void;
};

const JOIN_MAX_WIDTH = 480;

/**
 * Pure layout for the not-yet-joined state of the space detail screen. Uses
 * the shared {@link ScreenBase} chrome (breadcrumb-driven back on mobile,
 * centered title from the trail) plus the standard overflow-only debug
 * action; the bespoke inline back button on the join card was removed in
 * favor of chrome-managed navigation.
 */
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
        label: t`Developer tools`,
        icon: 'chevron.left.forwardslash.chevron.right',
        onPress: onOpenDebug,
        overflow: 'always',
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
            <SpaceJoinButton spaceId={spaceId} />
          </Box>
        </Box>
      )}
    />
  );
}
