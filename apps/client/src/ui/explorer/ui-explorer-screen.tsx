import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Trans } from '@lingui/react/macro';
import { Box, ScreenBase } from '@pkgs/ui';
import { ExplorerList } from '@pkgs/ui/explorer';
import { useRouter } from 'expo-router';

export function UiExplorerScreen() {
  const router = useRouter();
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      screenId="ui-explorer"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>UI Components</Trans> },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          <ExplorerList
            screenBodyBleed
            onSelect={(name) => router.push(`/ui/${encodeURIComponent(name)}`)}
          />
        </Box>
      )}
    />
  );
}
