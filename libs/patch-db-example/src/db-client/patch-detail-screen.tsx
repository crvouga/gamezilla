import type { Patch } from '@gamezilla/patch-db/interface';
import { usePatchesDb } from '@gamezilla/patch-db/react';
import {
  Box,
  Card,
  Divider,
  Pressable,
  ScrollView,
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

export type PatchDetailScreenProps = {
  entityType: string;
  entityId: string;
  patchId: string;
  /** Navigate to another patch (e.g. parent) — caller wires router.push. */
  onNavigateToPatch: (patch: Patch) => void;
};

export function PatchDetailScreen({
  entityType,
  entityId,
  patchId,
  onNavigateToPatch,
}: PatchDetailScreenProps) {
  const theme = useTheme();
  const db = usePatchesDb();
  const [patch, setPatch] = useState<Patch | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingParent, setLoadingParent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setLoadError(null);
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
          if (!cancelled) setLoadError('Empty read result');
          return;
        }
        const found = result.patches.find((p) => p.patchId === patchId);
        if (!cancelled) {
          if (found !== undefined) {
            setPatch(found);
          } else {
            setPatch(null);
            setLoadError('Patch not found');
          }
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [db, entityType, entityId, patchId]);

  const metaRows = useMemo(() => {
    if (patch === null) return [];
    return [
      ['patchId', patch.patchId],
      ['parentId', patch.parentId ?? 'null'],
      ['entityId', patch.entityId],
      ['entityType', patch.entityType],
      ['createdAt', patch.createdAt],
      ['recordedAt', patch.recordedAt],
      ['createdBy', patch.createdBy],
      ['sessionId', patch.sessionId],
    ] as const;
  }, [patch]);

  const attrEntries = useMemo(() => {
    if (patch === null) return [];
    return Object.entries(patch.attributes).sort(([a], [b]) =>
      a.localeCompare(b)
    );
  }, [patch]);

  const loadParent = useCallback(async () => {
    if (patch === null) return;
    const pid = patch.parentId;
    if (pid === null) return;
    setLoadingParent(true);
    try {
      const results = await db.read([
        {
          entityType: patch.entityType,
          entityId: patch.entityId,
          on: 'patches',
          limit: 500,
        },
      ]);
      const result = results[0];
      if (result === undefined) return;
      const found = result.patches.find((p) => p.patchId === pid);
      if (found !== undefined) {
        onNavigateToPatch(found);
      }
    } finally {
      setLoadingParent(false);
    }
  }, [db, onNavigateToPatch, patch]);

  if (loading) {
    return (
      <Box sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="large" />
      </Box>
    );
  }

  if (loadError !== null || patch === null) {
    return (
      <Box sx={{ flex: 1, p: 4 }}>
        <Text
          variant="body"
          style={{ color: theme.colors.destructive }}
          label={loadError ?? 'Patch not found'}
        />
      </Box>
    );
  }

  return (
    <ScrollView sx={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <Card elevation={1} sx={{ mb: 3 }}>
        <Box sx={{ px: 3, py: 2 }}>
          <Text variant="bodyBold" label="Patch metadata" />
        </Box>
        <Divider />
        {metaRows.map(([key, value], i) => (
          <Box key={key}>
            <Stack
              direction="horizontal"
              spacing={2}
              sx={{ px: 3, py: 2 }}
              align="center"
            >
              <Text
                variant="mono"
                style={{ fontSize: 11, color: theme.colors.tint, flex: 0.9 }}
                label={key}
              />
              <Text
                variant="mono"
                style={{ fontSize: 11, flex: 1.4 }}
                numberOfLines={3}
                label={String(value)}
              />
            </Stack>
            {i < metaRows.length - 1 ? <Divider /> : null}
          </Box>
        ))}
        {patch.parentId !== null ? (
          <>
            <Divider />
            <Box sx={{ px: 3, py: 2 }}>
              {loadingParent ? (
                <Spinner />
              ) : (
                <Pressable onPress={() => void loadParent()}>
                  <Text
                    variant="label"
                    sx={{ color: 'tint' }}
                    label="View parent patch"
                  />
                </Pressable>
              )}
            </Box>
          </>
        ) : null}
      </Card>

      <Card elevation={1}>
        <Box sx={{ px: 3, py: 2 }}>
          <Text variant="bodyBold" label="Patch attributes" />
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
                  style={{ fontSize: 11, color: theme.colors.tint, flex: 1 }}
                  label={key}
                />
                <ValueKindBadge value={value} />
              </Stack>
              {value !== null && typeof value === 'object' ? (
                <JsonCollapsible title="Value" value={value} />
              ) : (
                <FormattedInlineValue value={value} maxLen={500} />
              )}
            </Stack>
            {i < attrEntries.length - 1 ? <Divider /> : null}
          </Box>
        ))}
      </Card>
    </ScrollView>
  );
}
