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

const PAGE_SIZE = 500;

export type EntityTypesScreenProps = {
  onSelectType: (entityType: string) => void;
  onOpenQuery: () => void;
};

export function EntityTypesScreen({
  onSelectType,
  onOpenQuery,
}: EntityTypesScreenProps) {
  const db = usePatchesDb();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [totalRows, setTotalRows] = useState(0);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const next = new Map<string, number>();
    let offset = 0;
    let total = 0;
    try {
      while (true) {
        const results = await db.read([
          {
            limit: PAGE_SIZE,
            offset,
          },
        ]);
        const result = results[0];
        if (result === undefined) break;
        total = result.total;
        for (const e of result.entities) {
          const t = e.entityType;
          next.set(t, (next.get(t) ?? 0) + 1);
        }
        if (!result.hasMore) break;
        offset += PAGE_SIZE;
      }
      setCounts(next);
      setTotalRows(total);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = [...counts.entries()]
      .map(([entityType, count]) => ({ entityType, count }))
      .sort((a, b) => a.entityType.localeCompare(b.entityType));
    if (!q) return list;
    return list.filter((r) => r.entityType.toLowerCase().includes(q));
  }, [counts, filter]);

  return (
    <Box sx={{ flex: 1 }}>
      <Stack spacing={3} sx={{ p: 3 }}>
        <Stack direction="horizontal" spacing={2} align="center">
          <Button
            title="Run query"
            variant="solid"
            size="sm"
            onPressIn={onOpenQuery}
          />
          <Button
            title="Refresh"
            variant="ghost"
            size="sm"
            onPressIn={() => void loadAll()}
          />
        </Stack>
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Filter types…"
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
        {loading ? (
          <Box sx={{ py: 8, alignItems: 'center' }}>
            <Spinner size="large" />
            <Text
              variant="caption"
              style={{ marginTop: 12, color: theme.colors.textSecondary }}
              label="Scanning snapshots…"
            />
          </Box>
        ) : error !== null ? (
          <Card
            elevation={0}
            sx={{ p: 4 }}
            style={{
              borderWidth: 1,
              borderColor: theme.colors.destructive + '44',
              backgroundColor: theme.colors.destructive + '0a',
            }}
          >
            <Text
              variant="body"
              style={{ color: theme.colors.destructive }}
              label={error}
            />
          </Card>
        ) : (
          <Text
            variant="caption"
            style={{ color: theme.colors.textSecondary }}
            label={`${totalRows} snapshot row(s) · ${counts.size} type(s)`}
          />
        )}
      </Stack>

      {!loading && error === null ? (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.entityType}
          style={theme.sx({ flex: 1 })}
          sx={{ px: 3, pb: 8 }}
          renderItem={({ item }) => (
            <Pressable onPressIn={() => onSelectType(item.entityType)}>
              <Card elevation={1} sx={{ mb: 2, p: 3 }}>
                <Stack
                  direction="horizontal"
                  align="center"
                  justify="space-between"
                >
                  <Text
                    variant="mono"
                    style={{ fontSize: 13, flex: 1 }}
                    label={item.entityType}
                  />
                  <Text
                    variant="caption"
                    style={{ color: theme.colors.textSecondary }}
                    label={String(item.count)}
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
                filter.trim()
                  ? 'No types match filter.'
                  : 'No entities in this database.'
              }
            />
          }
        />
      ) : null}
    </Box>
  );
}
