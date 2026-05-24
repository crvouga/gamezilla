import {
  Box,
  Button,
  Card,
  FlatList,
  Pressable,
  SpinnerBox,
  Stack,
  Text,
  TextInput,
  useTheme,
} from '@pkgs/ui';
import type { Entity } from '@pkgs/patch-db/interface';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { usePatchDb } from '@pkgs/patch-db/react';
import { formatAttrValue } from './format-value';

const PAGE_SIZE = 50;

function entityMatchesSearch(entity: Entity, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (entity.entityId.toLowerCase().includes(needle)) return true;
  for (const v of Object.values(entity.attributes)) {
    if (formatAttrValue(v).toLowerCase().includes(needle)) return true;
  }
  return false;
}

function previewAttributes(entity: Entity): string {
  const attrs = entity.attributes as Record<string, unknown>;
  const keys = Object.keys(attrs).slice(0, 4);
  if (keys.length === 0) return '—';
  return keys
    .map((k) => {
      const v = attrs[k];
      const s = formatAttrValue(v);
      return `${k}: ${s.length > 40 ? s.slice(0, 39) + '…' : s}`;
    })
    .join(' · ');
}

type PageState = {
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  entities: Entity[];
  offset: number;
  hasMore: boolean;
  total: number;
  fetchPage: (start: number, append: boolean) => Promise<void>;
};

function useEntityPager(entityType: string): PageState {
  const { t } = useLingui();
  const db = usePatchDb();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchPage = useCallback(
    async (startOffset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const results = await db.read([
          { entityType, limit: PAGE_SIZE, offset: startOffset },
        ]);
        const result = results[0];
        if (result === undefined) {
          setError(t`Empty read result`);
          return;
        }
        setTotal(result.total);
        setHasMore(result.hasMore);
        setOffset(startOffset + result.entities.length);
        setEntities((prev) =>
          append ? [...prev, ...result.entities] : result.entities
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [db, entityType, t]
  );

  useEffect(() => {
    setEntities([]);
    setOffset(0);
    void fetchPage(0, false);
  }, [entityType, fetchPage]);

  return {
    loading,
    loadingMore,
    error,
    entities,
    offset,
    hasMore,
    total,
    fetchPage,
  };
}

function FilterBar({
  search,
  setSearch,
  total,
  loaded,
  shown,
}: {
  search: string;
  setSearch: (v: string) => void;
  total: number;
  loaded: number;
  shown: number;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Stack spacing={2} sx={{ px: 3, pt: 2, pb: 2 }}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t`Filter loaded rows (id or attributes)…`}
        autoCapitalize="none"
        autoCorrect={false}
        sx={{
          borderWidth: 1,
          borderRadius: 8,
          px: 3,
          py: 2.5,
          fontSize: 15,
          background: 'surface',
          color: 'text',
          borderColor: 'border',
        }}
      />
      <Text
        variant="caption"
        style={{ color: theme.colors.textSecondary }}
        label={t`${total} total · ${loaded} loaded · ${shown} shown`}
      />
    </Stack>
  );
}

function EntityCard({
  entity,
  onPress,
}: {
  entity: Entity;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress}>
      <Card elevation={1} sx={{ mb: 2, p: 3 }}>
        <Stack spacing={1}>
          <Text
            variant="mono"
            style={{ fontSize: 12 }}
            label={entity.entityId}
          />
          <Text
            variant="caption"
            style={{ color: theme.colors.textSecondary }}
            numberOfLines={3}
            label={previewAttributes(entity)}
          />
        </Stack>
      </Card>
    </Pressable>
  );
}

function EntityList({
  filtered,
  total,
  hasMore,
  loadingMore,
  onLoadMore,
  onSelectEntity,
}: {
  filtered: Entity[];
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelectEntity: (id: string) => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.entityId}
      style={theme.sx({ flex: 1 })}
      sx={{ px: 3, pb: 4 }}
      renderItem={({ item }) => (
        <EntityCard
          entity={item}
          onPress={() => onSelectEntity(item.entityId)}
        />
      )}
      ListEmptyComponent={
        <Text
          variant="body"
          style={{ opacity: 0.7, textAlign: 'center', padding: 24 }}
          label={
            total === 0
              ? t`No entities for this type.`
              : t`No rows match filter.`
          }
        />
      }
      ListFooterComponent={
        hasMore ? (
          <Box sx={{ py: 3, alignItems: 'center' }}>
            <Button
              title={loadingMore ? t`Loading…` : t`Load more`}
              intent="neutral"
              size="sm"
              onPress={onLoadMore}
            />
          </Box>
        ) : null
      }
    />
  );
}

export type EntitiesScreenProps = {
  entityType: string;
  onSelectEntity: (entityId: string) => void;
};

export function EntitiesScreen({
  entityType,
  onSelectEntity,
}: EntitiesScreenProps) {
  const theme = useTheme();
  const pager = useEntityPager(entityType);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim();
    return pager.entities.filter((e) => entityMatchesSearch(e, q));
  }, [pager.entities, search]);

  const onLoadMore = () => {
    if (!pager.hasMore || pager.loadingMore) return;
    void pager.fetchPage(pager.offset, true);
  };

  return (
    <Box sx={{ flex: 1 }}>
      <FilterBar
        search={search}
        setSearch={setSearch}
        total={pager.total}
        loaded={pager.entities.length}
        shown={filtered.length}
      />

      {pager.loading ? (
        <SpinnerBox sx={{ flex: 1 }} size="large" />
      ) : pager.error !== null ? (
        <Box sx={{ p: 4 }}>
          <Text
            variant="body"
            style={{ color: theme.colors.destructive }}
            label={pager.error}
          />
        </Box>
      ) : (
        <EntityList
          filtered={filtered}
          total={pager.entities.length}
          hasMore={pager.hasMore}
          loadingMore={pager.loadingMore}
          onLoadMore={onLoadMore}
          onSelectEntity={onSelectEntity}
        />
      )}
    </Box>
  );
}
