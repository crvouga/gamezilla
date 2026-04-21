import type { Entity } from '@gamezilla/patch-db/interface';
import { usePatchesDb } from '@gamezilla/patch-db/react';
import {
  Box,
  Button,
  Card,
  FlatList,
  Pressable,
  Spinner,
  Stack,
  Text,
  TextInput,
  useTheme,
} from '@gamezilla/shared/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  const keys = Object.keys(entity.attributes).slice(0, 4);
  if (keys.length === 0) return '—';
  return keys
    .map((k) => {
      const v = entity.attributes[k];
      const s = formatAttrValue(v);
      return `${k}: ${s.length > 40 ? s.slice(0, 39) + '…' : s}`;
    })
    .join(' · ');
}

export type EntitiesScreenProps = {
  entityType: string;
  onSelectEntity: (entityId: string) => void;
};

export function EntitiesScreen({
  entityType,
  onSelectEntity,
}: EntitiesScreenProps) {
  const db = usePatchesDb();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  const fetchPage = useCallback(
    async (startOffset: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const results = await db.read([
          {
            entityType,
            limit: PAGE_SIZE,
            offset: startOffset,
          },
        ]);
        const result = results[0];
        if (result === undefined) {
          setError('Empty read result');
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
    [db, entityType]
  );

  useEffect(() => {
    setEntities([]);
    setOffset(0);
    void fetchPage(0, false);
  }, [entityType, fetchPage]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return entities.filter((e) => entityMatchesSearch(e, q));
  }, [entities, search]);

  const onLoadMore = () => {
    if (!hasMore || loadingMore) return;
    void fetchPage(offset, true);
  };

  return (
    <Box sx={{ flex: 1 }}>
      <Stack spacing={2} sx={{ px: 3, pt: 2, pb: 2 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Filter loaded rows (id or attributes)…"
          autoCapitalize="none"
          autoCorrect={false}
          sx={{
            borderWidth: 1,
            borderRadius: 8,
            px: 3,
            py: 2.5,
            fontSize: 15,
            background: 'paper',
            color: 'text',
            borderColor: 'border',
          }}
        />
        <Text
          variant="caption"
          style={{ color: theme.colors.textSecondary }}
          label={`${total} total · ${entities.length} loaded · ${filtered.length} shown`}
        />
      </Stack>

      {loading ? (
        <Box sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size="large" />
        </Box>
      ) : error !== null ? (
        <Box sx={{ p: 4 }}>
          <Text
            variant="body"
            style={{ color: theme.colors.destructive }}
            label={error}
          />
        </Box>
      ) : (
        <>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.entityId}
            style={theme.sx({ flex: 1 })}
            sx={{ px: 3, pb: 4 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => onSelectEntity(item.entityId)}>
                <Card elevation={1} sx={{ mb: 2, p: 3 }}>
                  <Stack spacing={1}>
                    <Text
                      variant="mono"
                      style={{ fontSize: 12 }}
                      label={item.entityId}
                    />
                    <Text
                      variant="caption"
                      style={{ color: theme.colors.textSecondary }}
                      numberOfLines={3}
                      label={previewAttributes(item)}
                    />
                  </Stack>
                </Card>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text
                variant="body"
                style={{ opacity: 0.7, textAlign: 'center', padding: 24 }}
                label={
                  entities.length === 0
                    ? 'No entities for this type.'
                    : 'No rows match filter.'
                }
              />
            }
            ListFooterComponent={
              hasMore ? (
                <Box sx={{ py: 3, alignItems: 'center' }}>
                  <Button
                    title={loadingMore ? 'Loading…' : 'Load more'}
                    variant="ghost"
                    size="sm"
                    onPress={onLoadMore}
                  />
                </Box>
              ) : null
            }
          />
        </>
      )}
    </Box>
  );
}
