import type { Patch } from '@gamezilla/patch-db/interface';
import { useEntity, usePatchesDb } from '@gamezilla/patch-db/react';
import {
  Box,
  Card,
  Divider,
  FlatList,
  Pressable,
  ScrollView,
  SegmentedControl,
  Spinner,
  Stack,
  Text,
  useTheme,
} from '@gamezilla/lib/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  FormattedInlineValue,
  JsonCollapsible,
  ValueKindBadge,
} from './format-value';

export type EntityDetailScreenProps = {
  entityType: string;
  entityId: string;
  onSelectPatch: (patch: Patch) => void;
};

export function EntityDetailScreen({
  entityType,
  entityId,
  onSelectPatch,
}: EntityDetailScreenProps) {
  const theme = useTheme();
  const db = usePatchesDb();
  const entity = useEntity({ entityType, entityId });
  const [tab, setTab] = useState<'attrs' | 'patches'>('attrs');
  const [patches, setPatches] = useState<Patch[]>([]);
  const [loadingPatches, setLoadingPatches] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);

  const loadPatches = useCallback(async () => {
    setLoadingPatches(true);
    setPatchError(null);
    try {
      const results = await db.read([
        {
          entityType,
          entityId,
          on: 'patches',
          limit: 500,
        },
      ]);
      const result = results[0];
      if (result === undefined) {
        setPatches([]);
        return;
      }
      const sorted = [...result.patches].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      setPatches(sorted);
    } catch (e) {
      setPatchError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingPatches(false);
    }
  }, [db, entityType, entityId]);

  useEffect(() => {
    if (tab === 'patches') {
      void loadPatches();
    }
  }, [tab, loadPatches]);

  const attrEntries = useMemo(() => {
    if (entity === null) return [];
    return Object.entries(entity.attributes).sort(([a], [b]) =>
      a.localeCompare(b)
    );
  }, [entity]);

  return (
    <Box sx={{ flex: 1 }}>
      <Box sx={{ px: 3, py: 2 }}>
        <SegmentedControl
          segments={[
            { key: 'attrs', label: 'Attributes' },
            { key: 'patches', label: 'Patches' },
          ]}
          selected={tab}
          onSelect={(k) => setTab(k as 'attrs' | 'patches')}
        />
      </Box>
      <Box sx={{ flex: 1 }}>
        {tab === 'attrs' ? (
          entity === null ? (
            <Box sx={{ p: 6, alignItems: 'center' }}>
              <Spinner size="large" />
              <Text
                variant="caption"
                style={{ marginTop: 12, color: theme.colors.textSecondary }}
                label="Loading entity…"
              />
            </Box>
          ) : (
            <ScrollView
              sx={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
            >
              <Card elevation={1}>
                <Box sx={{ px: 3, py: 2 }}>
                  <Text variant="caption" label={entity.entityType} />
                  <Text
                    variant="mono"
                    style={{ fontSize: 12 }}
                    label={entity.entityId}
                  />
                </Box>
                <Divider />
                {attrEntries.map(([key, value], i) => (
                  <Box key={key}>
                    <Stack spacing={2} sx={{ px: 3, py: 2.5 }}>
                      <Stack
                        direction="horizontal"
                        align="center"
                        justify="space-between"
                      >
                        <Text
                          variant="mono"
                          style={{
                            fontSize: 11,
                            color: theme.colors.tint,
                            flex: 1,
                          }}
                          label={key}
                        />
                        <ValueKindBadge value={value} />
                      </Stack>
                      {value !== null && typeof value === 'object' ? (
                        <JsonCollapsible title="Value" value={value} />
                      ) : (
                        <Box sx={{ alignSelf: 'stretch' }}>
                          <FormattedInlineValue value={value} maxLen={400} />
                        </Box>
                      )}
                    </Stack>
                    {i < attrEntries.length - 1 ? <Divider /> : null}
                  </Box>
                ))}
              </Card>
            </ScrollView>
          )
        ) : loadingPatches ? (
          <Box sx={{ p: 6, alignItems: 'center' }}>
            <Spinner size="large" />
          </Box>
        ) : patchError !== null ? (
          <Box sx={{ p: 4 }}>
            <Text
              variant="body"
              style={{ color: theme.colors.destructive }}
              label={patchError}
            />
          </Box>
        ) : (
          <FlatList
            data={patches}
            keyExtractor={(p) => p.patchId}
            style={theme.sx({ flex: 1 })}
            sx={{ p: 3 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => onSelectPatch(item)}>
                <Card elevation={1} sx={{ mb: 2, p: 3 }}>
                  <Stack spacing={1}>
                    <Text
                      variant="mono"
                      style={{ fontSize: 11 }}
                      numberOfLines={1}
                      label={item.patchId}
                    />
                    <Text
                      variant="caption"
                      style={{ color: theme.colors.textSecondary }}
                      label={`${item.createdAt} · ${item.createdBy || '—'}`}
                    />
                  </Stack>
                </Card>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text
                variant="body"
                style={{ opacity: 0.7 }}
                label="No patches for this entity."
              />
            }
          />
        )}
      </Box>
    </Box>
  );
}
