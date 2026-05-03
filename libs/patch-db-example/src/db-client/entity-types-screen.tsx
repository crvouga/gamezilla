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
} from '@gamezilla/lib/ui';
import { usePatchDb } from '@gamezilla/patch-db/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useState } from 'react';

const PAGE_SIZE = 500;

export type EntityTypesScreenProps = {
  onSelectType: (entityType: string) => void;
  onOpenQuery: () => void;
};

type LoadState = {
  loading: boolean;
  error: string | null;
  counts: Map<string, number>;
  totalRows: number;
  loadAll: () => Promise<void>;
};

function useEntityTypeCounts(): LoadState {
  const db = usePatchDb();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        const results = await db.read([{ limit: PAGE_SIZE, offset }]);
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

  return { loading, error, counts, totalRows, loadAll };
}

function HeaderControls({
  filter,
  setFilter,
  onOpenQuery,
  onRefresh,
}: {
  filter: string;
  setFilter: (v: string) => void;
  onOpenQuery: () => void;
  onRefresh: () => void;
}) {
  const { t } = useLingui();
  return (
    <>
      <Stack direction="horizontal" spacing={2} align="center">
        <Button
          title={<Trans>Run query</Trans>}
          variant="solid"
          size="sm"
          onPress={onOpenQuery}
        />
        <Button
          title={<Trans>Refresh</Trans>}
          variant="ghost"
          size="sm"
          onPress={onRefresh}
        />
      </Stack>
      <TextInput
        value={filter}
        onChangeText={setFilter}
        placeholder={t`Filter types…`}
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
    </>
  );
}

function StatusLine({
  loading,
  error,
  totalRows,
  typeCount,
}: {
  loading: boolean;
  error: string | null;
  totalRows: number;
  typeCount: number;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  if (loading) {
    return (
      <Box sx={{ py: 8, alignItems: 'center' }}>
        <Spinner size="large" />
        <Text
          variant="caption"
          style={{ marginTop: 12, color: theme.colors.textSecondary }}
          label={t`Scanning snapshots…`}
        />
      </Box>
    );
  }
  if (error !== null) {
    return (
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
    );
  }
  return (
    <Text
      variant="caption"
      style={{ color: theme.colors.textSecondary }}
      label={t`${totalRows} snapshot row(s) · ${typeCount} type(s)`}
    />
  );
}

function TypeRowCard({
  entityType,
  count,
  onPress,
}: {
  entityType: string;
  count: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress}>
      <Card elevation={1} sx={{ mb: 2, p: 3 }}>
        <Stack direction="horizontal" align="center" justify="space-between">
          <Text
            variant="mono"
            style={{ fontSize: 13, flex: 1 }}
            label={entityType}
          />
          <Text
            variant="caption"
            style={{ color: theme.colors.textSecondary }}
            label={String(count)}
          />
        </Stack>
      </Card>
    </Pressable>
  );
}

export function EntityTypesScreen({
  onSelectType,
  onOpenQuery,
}: EntityTypesScreenProps) {
  const { t } = useLingui();
  const theme = useTheme();
  const { loading, error, counts, totalRows, loadAll } = useEntityTypeCounts();
  const [filter, setFilter] = useState('');

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
        <HeaderControls
          filter={filter}
          setFilter={setFilter}
          onOpenQuery={onOpenQuery}
          onRefresh={() => void loadAll()}
        />
        <StatusLine
          loading={loading}
          error={error}
          totalRows={totalRows}
          typeCount={counts.size}
        />
      </Stack>

      {!loading && error === null ? (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.entityType}
          style={theme.sx({ flex: 1 })}
          sx={{ px: 3, pb: 8 }}
          renderItem={({ item }) => (
            <TypeRowCard
              entityType={item.entityType}
              count={item.count}
              onPress={() => onSelectType(item.entityType)}
            />
          )}
          ListEmptyComponent={
            <Text
              variant="body"
              style={{ opacity: 0.7, textAlign: 'center', padding: 24 }}
              label={
                filter.trim()
                  ? t`No types match filter.`
                  : t`No entities in this database.`
              }
            />
          }
        />
      ) : null}
    </Box>
  );
}
