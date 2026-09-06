import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Trans } from '@lingui/react/macro';
import { Box, ScreenBase, useRouter } from '@pkgs/ui-rn';
import { ExplorerList } from '@pkgs/ui-rn/explorer';

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
        <Box sx={sx}>
          <ExplorerList
            screenBodyBleed
            onSelect={(name) => router.push(`/ui/${encodeURIComponent(name)}`)}
          />
        </Box>
      )}
    />
  );
}
