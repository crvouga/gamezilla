import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { Box, ScreenBase } from '@gamezilla/lib/ui';
import { ExplorerDetail } from '@gamezilla/lib/ui/explorer';
import { Trans, useLingui } from '@lingui/react/macro';
import { useLocalSearchParams } from 'expo-router';

export function UiExplorerDetailScreen() {
  const { t } = useLingui();
  const { component } = useLocalSearchParams<{ component: string }>();
  const name = component ?? '';
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Developer</Trans>, onPress: nav('/more/developer') },
        { name: <Trans>UI Components</Trans>, onPress: nav('/ui') },
        { name: name || t`Component` },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          <ExplorerDetail componentName={name} />
        </Box>
      )}
    />
  );
}
