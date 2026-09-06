import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  CatalogDetailNav,
  type CatalogItem,
  ScreenBase,
  useLocalSearchParams,
  useRouter,
} from '@pkgs/ui-rn';
import {
  type ComponentEntry,
  ExplorerDetail,
  useComponentRegistry,
} from '@pkgs/ui-rn/explorer';
import { useCallback, useMemo } from 'react';

function toCatalogItems(entries: readonly ComponentEntry[]): CatalogItem[] {
  return entries.map((c) => ({
    id: c.name,
    label: c.name,
    category: c.category,
  }));
}

export function UiExplorerDetailScreen() {
  const { t } = useLingui();
  const router = useRouter();
  const { component } = useLocalSearchParams<{ component: string }>();
  const name = component ?? '';
  const nav = useBreadcrumbNav();
  const registry = useComponentRegistry();
  const items = useMemo(() => toCatalogItems(registry), [registry]);

  const onNavigate = useCallback(
    (nextName: string) => {
      router.replace(`/ui/${encodeURIComponent(nextName)}`);
    },
    [router]
  );

  return (
    <ScreenBase
      screenId="ui-explorer-detail"
      largeTitle
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>UI Components</Trans>, onPress: nav('/ui') },
        { name: name || t`Component` },
      ]}
      content={({ sx, titleScroll }) => (
        <Box sx={sx}>
          <ExplorerDetail
            screenBodyBleed
            largeTitle
            componentName={name}
            {...(titleScroll === undefined ? {} : { titleScroll })}
          />
        </Box>
      )}
      footer={
        <CatalogDetailNav
          items={items}
          currentId={name}
          onNavigate={onNavigate}
        />
      }
    />
  );
}
