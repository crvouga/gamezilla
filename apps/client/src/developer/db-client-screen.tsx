import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Box, ScreenBaseHeader } from '@pkgs/ui';
import {
  buildExplorerScreenBreadcrumbs,
  ExplorerRoute,
  type PatchDbExplorerApplyParams,
  type PatchDbExplorerParams,
} from '@pkgs/patch-db-example/db-client/navigator';
import { Trans, useLingui } from '@lingui/react/macro';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

type RawParams = Partial<
  Record<keyof PatchDbExplorerParams, string | string[]>
>;

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function readExplorerParams(raw: RawParams): PatchDbExplorerParams {
  const out: PatchDbExplorerParams = {};
  const entityType = pickString(raw.entityType);
  if (entityType !== undefined && entityType !== '') {
    out.entityType = entityType;
  }
  const entityId = pickString(raw.entityId);
  if (entityId !== undefined && entityId !== '') {
    out.entityId = entityId;
  }
  const patchId = pickString(raw.patchId);
  if (patchId !== undefined && patchId !== '') {
    out.patchId = patchId;
  }
  const query = pickString(raw.query);
  if (query === '1') {
    out.query = '1';
  }
  return out;
}

export function DbClientScreen() {
  const router = useRouter();
  const rawParams = useLocalSearchParams<RawParams>();
  const nav = useBreadcrumbNav();
  const { t } = useLingui();

  const params = useMemo(() => readExplorerParams(rawParams), [rawParams]);

  // expo-router's setParams keeps existing params unless explicitly overridden,
  // so always pass an empty string for keys we want to clear from the URL.
  const applyParams = useCallback<PatchDbExplorerApplyParams>(
    (next) => {
      router.setParams({
        entityType: next.entityType ?? '',
        entityId: next.entityId ?? '',
        patchId: next.patchId ?? '',
        query: next.query ?? '',
      });
    },
    [router]
  );

  const explorerCrumbs = useMemo(
    () => buildExplorerScreenBreadcrumbs(params, applyParams, t),
    [params, applyParams, t]
  );

  const hasExplorerCrumbs = explorerCrumbs.length > 0;

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader
        breadcrumbs={[
          { name: <Trans>Spaces</Trans>, onPress: nav('/') },
          { name: <Trans>Settings</Trans>, onPress: nav('/more') },
          {
            name: <Trans>Developer</Trans>,
            onPress: nav('/more/developer'),
          },
          {
            name: <Trans>Patch DB Client</Trans>,
            ...(hasExplorerCrumbs
              ? { onPress: () => applyParams({}) }
              : { subtitle: <Trans>Browse entities and patch history</Trans> }),
          },
          ...explorerCrumbs,
        ]}
      />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ExplorerRoute
          params={params}
          applyParams={applyParams}
          onExit={() => router.replace('/more/developer' as Href)}
        />
      </Box>
    </Box>
  );
}
