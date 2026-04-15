import type { Patch } from '@gamezilla/patch-db/interface';
import { Box, Pressable, Text } from '@gamezilla/shared/ui';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo } from 'react';
import { BackHandler, useWindowDimensions } from 'react-native';

import {
  ColumnShell,
  type BreadcrumbItem,
  type ColumnPanel,
} from './column-shell';
import { EntitiesScreen } from './entities-screen';
import { EntityDetailScreen } from './entity-detail-screen';
import { EntityTypesScreen } from './entity-types-screen';
import { PatchDetailScreen } from './patch-detail-screen';
import { QueryScreen } from './query-screen';

/** Selection encoded in React Navigation params (source of truth). */
export type PatchDbExplorerParams = {
  entityType?: string;
  entityId?: string;
  patchId?: string;
  /** Query panel open when `'1'`. */
  query?: '1';
};

type PatchDbClientParamList = {
  explorer: PatchDbExplorerParams | undefined;
};

const Stack = createNativeStackNavigator<PatchDbClientParamList>();

function compactParams(p: PatchDbExplorerParams): PatchDbExplorerParams {
  const o: PatchDbExplorerParams = {};
  if (p.entityType !== undefined && p.entityType !== '') {
    o.entityType = p.entityType;
  }
  if (p.entityId !== undefined && p.entityId !== '') {
    o.entityId = p.entityId;
  }
  if (p.patchId !== undefined && p.patchId !== '') {
    o.patchId = p.patchId;
  }
  if (p.query === '1') {
    o.query = '1';
  }
  return o;
}

function normalizeParams(
  raw: PatchDbExplorerParams | undefined
): PatchDbExplorerParams {
  return compactParams(raw ?? {});
}

function carryQuery(
  prev: PatchDbExplorerParams,
  next: PatchDbExplorerParams
): PatchDbExplorerParams {
  if (prev.query === '1') {
    return { ...next, query: '1' };
  }
  return next;
}

function selectEntityType(
  prev: PatchDbExplorerParams,
  entityType: string
): PatchDbExplorerParams {
  return compactParams(carryQuery(prev, { entityType }));
}

function selectEntityId(
  prev: PatchDbExplorerParams,
  entityId: string
): PatchDbExplorerParams {
  const et = prev.entityType;
  if (et === undefined || et === '') {
    return compactParams(prev);
  }
  return compactParams(carryQuery(prev, { entityType: et, entityId }));
}

function selectPatch(
  prev: PatchDbExplorerParams,
  patch: Patch
): PatchDbExplorerParams {
  return compactParams(
    carryQuery(prev, {
      entityType: patch.entityType,
      entityId: patch.entityId,
      patchId: patch.patchId,
    })
  );
}

function openQuery(prev: PatchDbExplorerParams): PatchDbExplorerParams {
  const n = normalizeParams(prev);
  return compactParams({ ...n, query: '1' });
}

function closeQuery(prev: PatchDbExplorerParams): PatchDbExplorerParams {
  const n = normalizeParams(prev);
  const { query: _q, ...rest } = n;
  return compactParams(rest);
}

type ColumnKind = 'types' | 'entities' | 'entityDetail' | 'patch' | 'query';

function buildColumnKinds(p: PatchDbExplorerParams): ColumnKind[] {
  const cols: ColumnKind[] = ['types'];
  if (p.entityType !== undefined && p.entityType !== '') {
    cols.push('entities');
  }
  if (
    p.entityType !== undefined &&
    p.entityType !== '' &&
    p.entityId !== undefined &&
    p.entityId !== ''
  ) {
    cols.push('entityDetail');
  }
  if (
    p.entityType !== undefined &&
    p.entityType !== '' &&
    p.entityId !== undefined &&
    p.entityId !== '' &&
    p.patchId !== undefined &&
    p.patchId !== ''
  ) {
    cols.push('patch');
  }
  if (p.query === '1') {
    cols.push('query');
  }
  return cols;
}

function visibleColumnCount(width: number, total: number): number {
  if (total <= 1) return 1;
  const maxByWidth = width < 640 ? 1 : width < 900 ? 2 : width < 1200 ? 3 : 4;
  return Math.min(total, Math.max(1, maxByWidth));
}

function short(value: string, max = 28): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

type HeaderProps = {
  title: string;
  subtitle?: string;
  showBack: boolean;
  onBack: () => void;
};

function Header({ title, subtitle, showBack, onBack }: HeaderProps) {
  return (
    <Box
      sx={{
        background: 'paper',
        borderBottomWidth: 1,
        borderColor: 'border',
        px: 3,
        py: 2.5,
      }}
    >
      <Box sx={{ flexDirection: 'row', alignItems: 'center' }}>
        {showBack ? (
          <Pressable onPress={onBack} hitSlop={8}>
            <Text variant="label" sx={{ color: 'tint' }} label="Back" />
          </Pressable>
        ) : (
          <Box sx={{ width: 40 }} />
        )}
        <Box sx={{ flex: 1, alignItems: 'center', px: 2 }}>
          <Text
            variant="bodyBold"
            numberOfLines={1}
            ellipsizeMode="tail"
            label={title}
          />
          {subtitle !== undefined && subtitle !== '' ? (
            <Text variant="caption" numberOfLines={1} label={subtitle} />
          ) : null}
        </Box>
        <Box sx={{ width: 40 }} />
      </Box>
    </Box>
  );
}

function ExplorerRoute({
  navigation,
  route,
  onExit,
}: NativeStackScreenProps<PatchDbClientParamList, 'explorer'> & {
  onExit?: () => void;
}) {
  const { width } = useWindowDimensions();
  const params = useMemo(() => normalizeParams(route.params), [route.params]);

  /** Full replace — avoids stale keys from `setParams` merge. */
  const applyParams = useCallback(
    (next: PatchDbExplorerParams) => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'explorer', params: compactParams(next) }],
      });
    },
    [navigation]
  );

  const goBackOneLevel = useCallback(() => {
    if (params.query === '1') {
      applyParams(closeQuery(params));
      return;
    }
    if (params.patchId !== undefined && params.patchId !== '') {
      applyParams(
        compactParams(
          carryQuery(params, {
            entityType: params.entityType!,
            entityId: params.entityId!,
          })
        )
      );
      return;
    }
    if (params.entityId !== undefined && params.entityId !== '') {
      applyParams(
        compactParams(
          carryQuery(params, { entityType: params.entityType! })
        )
      );
      return;
    }
    if (params.entityType !== undefined && params.entityType !== '') {
      applyParams(compactParams(carryQuery(params, {})));
      return;
    }
    onExit?.();
  }, [applyParams, onExit, params]);

  const kinds = useMemo(() => buildColumnKinds(params), [params]);
  const totalCols = kinds.length;
  const visCount = visibleColumnCount(width, totalCols);
  const visibleKinds = kinds.slice(-visCount);
  const showBreadcrumbs = visCount === 1 && totalCols > 1;

  const breadcrumbs: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      {
        key: 'types',
        label: 'Types',
        onPress: () =>
          applyParams(compactParams(carryQuery(params, {}))),
      },
    ];
    if (params.entityType !== undefined && params.entityType !== '') {
      const entityType = params.entityType;
      items.push({
        key: 'et',
        label: entityType,
        onPress: () =>
          applyParams(
            compactParams(carryQuery(params, { entityType }))
          ),
      });
    }
    if (params.entityId !== undefined && params.entityId !== '') {
      const entityType = params.entityType;
      const entityId = params.entityId;
      if (entityType !== undefined && entityType !== '') {
        items.push({
          key: 'eid',
          label: short(entityId, 20),
          onPress: () =>
            applyParams(
              compactParams(carryQuery(params, { entityType, entityId }))
            ),
        });
      }
    }
    if (params.patchId !== undefined && params.patchId !== '') {
      const entityType = params.entityType;
      const entityId = params.entityId;
      const patchId = params.patchId;
      if (
        entityType !== undefined &&
        entityType !== '' &&
        entityId !== undefined &&
        entityId !== ''
      ) {
        items.push({
          key: 'pid',
          label: short(patchId, 18),
          onPress: () =>
            applyParams(
              compactParams(
                carryQuery(params, { entityType, entityId, patchId })
              )
            ),
        });
      }
    }
    if (params.query === '1') {
      items.push({
        key: 'q',
        label: 'Query',
        onPress: () => applyParams(params),
      });
    }
    return items;
  }, [applyParams, params]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const hasInApp =
        (params.entityType !== undefined && params.entityType !== '') ||
        (params.entityId !== undefined && params.entityId !== '') ||
        (params.patchId !== undefined && params.patchId !== '') ||
        params.query === '1';
      if (hasInApp) {
        goBackOneLevel();
        return true;
      }
      if (onExit !== undefined) {
        onExit();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [goBackOneLevel, onExit, params]);

  const headerTitle =
    visibleKinds[visibleKinds.length - 1] === 'query'
      ? 'Query'
      : visibleKinds[visibleKinds.length - 1] === 'patch'
        ? short(params.patchId ?? 'Patch', 24)
        : visibleKinds[visibleKinds.length - 1] === 'entityDetail'
          ? short(params.entityId ?? 'Entity', 28)
          : visibleKinds[visibleKinds.length - 1] === 'entities'
            ? (params.entityType ?? 'Entities')
            : 'Patch DB Client';

  const headerSubtitle =
    visibleKinds[visibleKinds.length - 1] === 'entityDetail'
      ? params.entityType
      : visibleKinds[visibleKinds.length - 1] === 'patch'
        ? 'Patch'
        : undefined;

  const panels: ColumnPanel[] = useMemo(() => {
    const out: ColumnPanel[] = [];
    for (const k of visibleKinds) {
      if (k === 'types') {
        out.push({
          key: 'types',
          title: 'Entity types',
          children: (
            <EntityTypesScreen
              onSelectType={(entityType) =>
                applyParams(selectEntityType(params, entityType))
              }
              onOpenQuery={() => applyParams(openQuery(params))}
            />
          ),
        });
      } else if (k === 'entities' && params.entityType !== undefined) {
        out.push({
          key: 'entities',
          title: 'Entities',
          children: (
            <EntitiesScreen
              entityType={params.entityType}
              onSelectEntity={(entityId) =>
                applyParams(selectEntityId(params, entityId))
              }
            />
          ),
        });
      } else if (
        k === 'entityDetail' &&
        params.entityType !== undefined &&
        params.entityId !== undefined
      ) {
        out.push({
          key: 'detail',
          title: 'Entity',
          children: (
            <EntityDetailScreen
              entityType={params.entityType}
              entityId={params.entityId}
              onSelectPatch={(patch) => applyParams(selectPatch(params, patch))}
            />
          ),
        });
      } else if (
        k === 'patch' &&
        params.entityType !== undefined &&
        params.entityId !== undefined &&
        params.patchId !== undefined
      ) {
        out.push({
          key: 'patch',
          title: 'Patch',
          children: (
            <PatchDetailScreen
              entityType={params.entityType}
              entityId={params.entityId}
              patchId={params.patchId}
              onNavigateToPatch={(patch) =>
                applyParams(selectPatch(params, patch))
              }
            />
          ),
        });
      } else if (k === 'query') {
        out.push({
          key: 'query',
          title: 'Query',
          children: (
            <QueryScreen onClose={() => applyParams(closeQuery(params))} />
          ),
        });
      }
    }
    return out;
  }, [applyParams, params, visibleKinds]);

  const canGoBackInApp =
    (params.entityType !== undefined && params.entityType !== '') ||
    (params.entityId !== undefined && params.entityId !== '') ||
    (params.patchId !== undefined && params.patchId !== '') ||
    params.query === '1';

  return (
    <Box sx={{ flex: 1 }}>
      <Header
        title={headerTitle}
        {...(headerSubtitle !== undefined && headerSubtitle !== ''
          ? { subtitle: headerSubtitle }
          : {})}
        showBack={canGoBackInApp || onExit !== undefined}
        onBack={goBackOneLevel}
      />
      <ColumnShell
        panels={panels}
        showBreadcrumbs={showBreadcrumbs}
        breadcrumbs={breadcrumbs}
      />
    </Box>
  );
}

export type PatchDbClientNavigatorProps = {
  onExit?: () => void;
};

export function PatchDbClientNavigator({
  onExit,
}: PatchDbClientNavigatorProps) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="explorer" initialParams={{}}>
        {(props) => (
          <ExplorerRoute
            {...props}
            {...(onExit !== undefined ? { onExit } : {})}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
