import type { Patch } from '@gamezilla/patch-db/interface';
import { asLocalized, type LocalizedString } from '@gamezilla/lib/i18n';
import {
  Box,
  ModalBackdrop,
  ModalContent,
  ModalRoot,
  ScreenBaseHeader,
  Text,
} from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { BackHandler, useWindowDimensions } from 'react-native';

type LinguiT = ReturnType<typeof useLingui>['t'];

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

function isFilled(v: string | undefined): v is string {
  return v !== undefined && v !== '';
}

function compactParams(p: PatchDbExplorerParams): PatchDbExplorerParams {
  const o: PatchDbExplorerParams = {};
  if (isFilled(p.entityType)) o.entityType = p.entityType;
  if (isFilled(p.entityId)) o.entityId = p.entityId;
  if (isFilled(p.patchId)) o.patchId = p.patchId;
  if (p.query === '1') o.query = '1';
  return o;
}

function normalizeParams(
  raw: PatchDbExplorerParams | undefined,
): PatchDbExplorerParams {
  return compactParams(raw ?? {});
}

function carryQuery(
  prev: PatchDbExplorerParams,
  next: PatchDbExplorerParams,
): PatchDbExplorerParams {
  if (prev.query === '1') {
    return { ...next, query: '1' };
  }
  return next;
}

function selectEntityType(
  prev: PatchDbExplorerParams,
  entityType: string,
): PatchDbExplorerParams {
  return compactParams(carryQuery(prev, { entityType }));
}

function selectEntityId(
  prev: PatchDbExplorerParams,
  entityId: string,
): PatchDbExplorerParams {
  const et = prev.entityType;
  if (!isFilled(et)) {
    return compactParams(prev);
  }
  return compactParams(carryQuery(prev, { entityType: et, entityId }));
}

function selectPatch(
  prev: PatchDbExplorerParams,
  patch: Patch,
): PatchDbExplorerParams {
  return compactParams(
    carryQuery(prev, {
      entityType: patch.entityType,
      entityId: patch.entityId,
      patchId: patch.patchId,
    }),
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

/* eslint-disable lingui/no-unlocalized-strings */
/** Left-to-right column roles (query is a modal, not a column). */
const EXPLORER_COLUMN_SLOTS: ColumnKind[] = ['types', 'entities', 'entityDetail', 'patch'];

function buildFilledKinds(p: PatchDbExplorerParams): ColumnKind[] {
  const cols: ColumnKind[] = ['types'];
  const hasType = isFilled(p.entityType);
  const hasEntity = hasType && isFilled(p.entityId);
  const hasPatch = hasEntity && isFilled(p.patchId);
  if (hasType) cols.push('entities');
  if (hasEntity) cols.push('entityDetail');
  if (hasPatch) cols.push('patch');
  return cols;
}
/* eslint-enable lingui/no-unlocalized-strings */

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
  slotCount: number,
): ColumnKind[] {
  if (filled.length <= slotCount) {
    return EXPLORER_COLUMN_SLOTS.slice(0, slotCount);
  }
  return filled.slice(-slotCount);
}

function EmptyColumnPlaceholder({ hint }: { hint: ReactNode }) {
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

type ApplyParams = (next: PatchDbExplorerParams) => void;

function useApplyParams(
  navigation: NavigationProp<PatchDbClientParamList>,
): ApplyParams {
  return useCallback(
    (next) => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'explorer', params: compactParams(next) }],
      });
    },
    [navigation],
  );
}

function useGoBackOneLevel(
  params: PatchDbExplorerParams,
  applyParams: ApplyParams,
  onExit?: () => void,
) {
  return useCallback(() => {
    if (params.query === '1') {
      applyParams(closeQuery(params));
      return;
    }
    if (isFilled(params.patchId)) {
      applyParams(
        compactParams(
          carryQuery(params, {
            ...(isFilled(params.entityType) && {
              entityType: params.entityType,
            }),
            ...(isFilled(params.entityId) && {
              entityId: params.entityId,
            }),
          }),
        ),
      );
      return;
    }
    if (isFilled(params.entityId)) {
      applyParams(
        compactParams(
          carryQuery(params, {
            ...(isFilled(params.entityType) && {
              entityType: params.entityType,
            }),
          }),
        ),
      );
      return;
    }
    if (isFilled(params.entityType)) {
      applyParams(compactParams(carryQuery(params, {})));
      return;
    }
    onExit?.();
  }, [applyParams, onExit, params]);
}

function useBackHandler(
  params: PatchDbExplorerParams,
  goBackOneLevel: () => void,
  onExit?: () => void,
) {
  useEffect(() => {
    // eslint-disable-next-line lingui/no-unlocalized-strings
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const hasInApp =
        isFilled(params.entityType) ||
        isFilled(params.entityId) ||
        isFilled(params.patchId) ||
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
}

function buildBreadcrumbs(
  params: PatchDbExplorerParams,
  applyParams: ApplyParams,
  t: LinguiT,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    {
      key: 'types',
      label: t`Types`,
      onPress: () => applyParams(compactParams(carryQuery(params, {}))),
    },
  ];
  const { entityType, entityId, patchId } = params;
  if (isFilled(entityType)) {
    items.push({
      key: 'et',
      label: entityType,
      onPress: () =>
        applyParams(compactParams(carryQuery(params, { entityType }))),
    });
  }
  if (isFilled(entityType) && isFilled(entityId)) {
    items.push({
      key: 'eid',
      label: short(entityId, 20),
      onPress: () =>
        applyParams(
          compactParams(carryQuery(params, { entityType, entityId })),
        ),
    });
  }
  if (isFilled(entityType) && isFilled(entityId) && isFilled(patchId)) {
    items.push({
      key: 'pid',
      label: short(patchId, 18),
      onPress: () =>
        applyParams(
          compactParams(
            carryQuery(params, { entityType, entityId, patchId }),
          ),
        ),
    });
  }
  if (params.query === '1') {
    items.push({
      key: 'q',
      label: t`Query`,
      onPress: () => applyParams(params),
    });
  }
  return items;
}

type PanelArgs = {
  params: PatchDbExplorerParams;
  applyParams: ApplyParams;
  t: LinguiT;
};

function buildTypesPanel({ params, applyParams, t }: PanelArgs): ColumnPanel {
  return {
    key: 'types',
    title: t`Entity types`,
    children: (
      <EntityTypesScreen
        onSelectType={(entityType) =>
          applyParams(selectEntityType(params, entityType))
        }
        onOpenQuery={() => applyParams(openQuery(params))}
      />
    ),
  };
}

function buildEntitiesPanel({ params, applyParams, t }: PanelArgs): ColumnPanel {
  return {
    key: 'entities',
    title: t`Entities`,
    children: isFilled(params.entityType) ? (
      <EntitiesScreen
        entityType={params.entityType}
        onSelectEntity={(entityId) =>
          applyParams(selectEntityId(params, entityId))
        }
      />
    ) : (
      <EmptyColumnPlaceholder
        hint={t`Select an entity type in the first column.`}
      />
    ),
  };
}

function buildEntityDetailPanel({ params, applyParams, t }: PanelArgs): ColumnPanel {
  return {
    key: 'detail',
    title: t`Entity`,
    children:
      isFilled(params.entityType) && isFilled(params.entityId) ? (
        <EntityDetailScreen
          entityType={params.entityType}
          entityId={params.entityId}
          onSelectPatch={(patch) => applyParams(selectPatch(params, patch))}
        />
      ) : (
        <EmptyColumnPlaceholder
          hint={t`Choose an entity from the list in the previous column.`}
        />
      ),
  };
}

function buildPatchPanel({ params, applyParams, t }: PanelArgs): ColumnPanel {
  return {
    key: 'patch',
    title: t`Patch`,
    children:
      isFilled(params.entityType) &&
      isFilled(params.entityId) &&
      isFilled(params.patchId) ? (
        <PatchDetailScreen
          entityType={params.entityType}
          entityId={params.entityId}
          patchId={params.patchId}
          onNavigateToPatch={(patch) => applyParams(selectPatch(params, patch))}
        />
      ) : (
        <EmptyColumnPlaceholder
          hint={t`Open a patch from the entity detail column.`}
        />
      ),
  };
}

function buildPanelForKind(kind: ColumnKind, args: PanelArgs): ColumnPanel {
  if (kind === 'types') return buildTypesPanel(args);
  if (kind === 'entities') return buildEntitiesPanel(args);
  if (kind === 'entityDetail') return buildEntityDetailPanel(args);
  return buildPatchPanel(args);
}

function getHeaderTitle(topVisibleKind: ColumnKind | undefined, params: PatchDbExplorerParams, t: LinguiT): LocalizedString {
  if (params.query === '1') return t`Query`;
  if (topVisibleKind === 'patch') return asLocalized(short(params.patchId ?? t`Patch`, 24));
  if (topVisibleKind === 'entityDetail') return asLocalized(short(params.entityId ?? t`Entity`, 28));
  if (topVisibleKind === 'entities') return params.entityType !== undefined ? asLocalized(params.entityType) : t`Entities`;
  return t`Patch DB Client`;
}

function getHeaderSubtitle(topVisibleKind: ColumnKind | undefined, params: PatchDbExplorerParams, t: LinguiT): LocalizedString | undefined {
  if (topVisibleKind === 'entityDetail') return params.entityType !== undefined ? asLocalized(params.entityType) : undefined;
  if (topVisibleKind === 'patch') return t`Patch`;
  return undefined;
}

type HeaderBreadcrumb = {
  name: LocalizedString;
  subtitle?: LocalizedString;
  onPress?: () => void;
};

function buildHeaderBreadcrumbs(
  args: {
    showHeaderBack: boolean;
    goBackOneLevel: () => void;
    headerTitle: LocalizedString;
    headerSubtitle: LocalizedString | undefined;
  },
  t: LinguiT,
): HeaderBreadcrumb[] {
  const { showHeaderBack, goBackOneLevel, headerTitle, headerSubtitle } = args;
  const titleEntry: HeaderBreadcrumb = {
    name: headerTitle,
    ...(headerSubtitle !== undefined ? { subtitle: headerSubtitle } : {}),
  };
  if (showHeaderBack) {
    return [{ name: t`Back`, onPress: goBackOneLevel }, titleEntry];
  }
  return [titleEntry];
}

function useExplorerLayout(params: PatchDbExplorerParams, width: number) {
  const filledKinds = useMemo(() => buildFilledKinds(params), [params]);
  const slotCount = maxSlotCountForWidth(width);
  const visibleKinds = useMemo(
    () => visibleKindsForLayout(filledKinds, slotCount),
    [filledKinds, slotCount],
  );
  const showBreadcrumbs = slotCount === 1 && filledKinds.length > 1;
  return { visibleKinds, showBreadcrumbs };
}

function canGoBackInApp(params: PatchDbExplorerParams): boolean {
  return (
    isFilled(params.entityType) ||
    isFilled(params.entityId) ||
    isFilled(params.patchId) ||
    params.query === '1'
  );
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
  const { t } = useLingui();
  const { width } = useWindowDimensions();
  const params = useMemo(() => normalizeParams(route.params), [route.params]);
  const applyParams = useApplyParams(navigation);
  const goBackOneLevel = useGoBackOneLevel(params, applyParams, onExit);

  const { visibleKinds, showBreadcrumbs } = useExplorerLayout(params, width);

  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(params, applyParams, t),
    [applyParams, params, t],
  );

  useBackHandler(params, goBackOneLevel, onExit);

  const topVisibleKind = visibleKinds[visibleKinds.length - 1];
  const headerTitle = getHeaderTitle(topVisibleKind, params, t);
  const headerSubtitle = getHeaderSubtitle(topVisibleKind, params, t);

  const panels = useMemo(
    () =>
      visibleKinds.map((k) =>
        buildPanelForKind(k, { params, applyParams, t }),
      ),
    [applyParams, params, visibleKinds, t],
  );

  const dismissQuery = useCallback(() => {
    applyParams(closeQuery(params));
  }, [applyParams, params]);

  const showHeaderBack = canGoBackInApp(params) || onExit !== undefined;
  const explorerBreadcrumbs = buildHeaderBreadcrumbs(
    { showHeaderBack, goBackOneLevel, headerTitle, headerSubtitle },
    t,
  );

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
