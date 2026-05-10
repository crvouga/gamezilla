import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { Box, ScreenBase } from '@gamezilla/ui';
import { ExplorerList } from '@gamezilla/ui/explorer';
import { Trans } from '@lingui/react/macro';
import { useRouter } from 'expo-router';

export function UiExplorerScreen() {
  const router = useRouter();
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Developer</Trans>, onPress: nav('/more/developer') },
        {
          name: <Trans>UI Components</Trans>,
          subtitle: <Trans>Shared UI explorer</Trans>,
        },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          <ExplorerList
            onSelect={(name) => router.push(`/ui/${encodeURIComponent(name)}`)}
          />
        </Box>
      )}
    />
  );
}
