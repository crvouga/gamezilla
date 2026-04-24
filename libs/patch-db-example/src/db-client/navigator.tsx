import type { Patch } from '@gamezilla/patch-db/interface';
import {
  Box,
  ModalBackdrop,
  ModalContent,
  ModalRoot,
  ScreenBaseHeader,
  Text,
} from '@gamezilla/lib/ui';
import { useCallback, useEffect, useMemo } from 'react';
import { BackHandler, useWindowDimensions } from 'react-native';

import { NavigationProp, RouteProp } from '@react-navigation/native';
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

type ColumnKind = 'types' | 'entities' | 'entityDetail' | 'patch';

/** Left-to-right column roles (query is a modal, not a column). */
const EXPLORER_COLUMN_SLOTS: ColumnKind[] = [
  'types',
  'entities',
  'entityDetail',
  'patch',
];

function buildFilledKinds(p: PatchDbExplorerParams): ColumnKind[] {
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
  return cols;
}

/** How many column frames to show for this width (always filled or empty). */
function maxSlotCountForWidth(width: number): number {
  return width < 640 ? 1 : width < 900 ? 2 : width < 1200 ? 3 : 4;
}

/**
 * When navigation is shallow, anchor columns to the left with empty placeholders.
 * When deeper than fits, show the rightmost slice (Finder-style).
 */
function visibleKindsForLayout(
  filled: ColumnKind[],
  slotCount: number
): ColumnKind[] {
  if (filled.length <= slotCount) {
    return EXPLORER_COLUMN_SLOTS.slice(0, slotCount);
  }
  return filled.slice(-slotCount);
}

function EmptyColumnPlaceholder({ hint }: { hint: string }) {
  return (
    <Box
      sx={{
        flex: 1,
        px: 3,
        py: 4,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text
        variant="caption"
        style={{ textAlign: 'center', opacity: 0.65 }}
        label={hint}
      />
    </Box>
  );
}

function short(value: string, max = 28): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function ExplorerRoute({
  navigation,
  route,
  onExit,
}: {
  navigation: NavigationProp<PatchDbClientParamList>;
  route: RouteProp<PatchDbClientParamList>;
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
        compactParams(carryQuery(params, { entityType: params.entityType! }))
      );
      return;
    }
    if (params.entityType !== undefined && params.entityType !== '') {
      applyParams(compactParams(carryQuery(params, {})));
      return;
    }
    onExit?.();
  }, [applyParams, onExit, params]);

  const filledKinds = useMemo(() => buildFilledKinds(params), [params]);
  const slotCount = maxSlotCountForWidth(width);
  const visibleKinds = useMemo(
    () => visibleKindsForLayout(filledKinds, slotCount),
    [filledKinds, slotCount]
  );
  const showBreadcrumbs = slotCount === 1 && filledKinds.length > 1;

  const breadcrumbs: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      {
        key: 'types',
        label: 'Types',
        onPress: () => applyParams(compactParams(carryQuery(params, {}))),
      },
    ];
    if (params.entityType !== undefined && params.entityType !== '') {
      const entityType = params.entityType;
      items.push({
        key: 'et',
        label: entityType,
        onPress: () =>
          applyParams(compactParams(carryQuery(params, { entityType }))),
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

  const topVisibleKind = visibleKinds[visibleKinds.length - 1];

  const headerTitle =
    params.query === '1'
      ? 'Query'
      : topVisibleKind === 'patch'
        ? short(params.patchId ?? 'Patch', 24)
        : topVisibleKind === 'entityDetail'
          ? short(params.entityId ?? 'Entity', 28)
          : topVisibleKind === 'entities'
            ? (params.entityType ?? 'Entities')
            : 'Patch DB Client';

  const headerSubtitle =
    topVisibleKind === 'entityDetail'
      ? params.entityType
      : topVisibleKind === 'patch'
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
      } else if (k === 'entities') {
        out.push({
          key: 'entities',
          title: 'Entities',
          children:
            params.entityType !== undefined && params.entityType !== '' ? (
              <EntitiesScreen
                entityType={params.entityType}
                onSelectEntity={(entityId) =>
                  applyParams(selectEntityId(params, entityId))
                }
              />
            ) : (
              <EmptyColumnPlaceholder hint="Select an entity type in the first column." />
            ),
        });
      } else if (k === 'entityDetail') {
        out.push({
          key: 'detail',
          title: 'Entity',
          children:
            params.entityType !== undefined &&
            params.entityType !== '' &&
            params.entityId !== undefined &&
            params.entityId !== '' ? (
              <EntityDetailScreen
                entityType={params.entityType}
                entityId={params.entityId}
                onSelectPatch={(patch) =>
                  applyParams(selectPatch(params, patch))
                }
              />
            ) : (
              <EmptyColumnPlaceholder hint="Choose an entity from the list in the previous column." />
            ),
        });
      } else if (k === 'patch') {
        out.push({
          key: 'patch',
          title: 'Patch',
          children:
            params.entityType !== undefined &&
            params.entityType !== '' &&
            params.entityId !== undefined &&
            params.entityId !== '' &&
            params.patchId !== undefined &&
            params.patchId !== '' ? (
              <PatchDetailScreen
                entityType={params.entityType}
                entityId={params.entityId}
                patchId={params.patchId}
                onNavigateToPatch={(patch) =>
                  applyParams(selectPatch(params, patch))
                }
              />
            ) : (
              <EmptyColumnPlaceholder hint="Open a patch from the entity detail column." />
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

  const dismissQuery = useCallback(() => {
    applyParams(closeQuery(params));
  }, [applyParams, params]);

  const showHeaderBack = canGoBackInApp || onExit !== undefined;
  const explorerBreadcrumbs = showHeaderBack
    ? [
        { name: 'Back', onPress: goBackOneLevel },
        {
          name: headerTitle,
          ...(headerSubtitle !== undefined && headerSubtitle !== ''
            ? { subtitle: headerSubtitle }
            : {}),
        },
      ]
    : [
        {
          name: headerTitle,
          ...(headerSubtitle !== undefined && headerSubtitle !== ''
            ? { subtitle: headerSubtitle }
            : {}),
        },
      ];

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader breadcrumbs={explorerBreadcrumbs} />
      <ColumnShell
        panels={panels}
        showBreadcrumbs={showBreadcrumbs}
        breadcrumbs={breadcrumbs}
      />
      <ModalRoot visible={params.query === '1'} onRequestClose={dismissQuery}>
        <ModalBackdrop onPress={dismissQuery}>
          <ModalContent
            style={{
              maxWidth: 720,
              width: '92%',
              maxHeight: '88%',
            }}
          >
            <QueryScreen onClose={dismissQuery} />
          </ModalContent>
        </ModalBackdrop>
      </ModalRoot>
    </Box>
  );
}
