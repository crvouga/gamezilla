import { useLingui } from '@lingui/react/macro';
import type { Patch } from '@pkgs/patch-db/interface';
import { usePatchDb } from '@pkgs/patch-db/react';
import {
  Box,
  Card,
  Divider,
  ErrorState,
  LoadingState,
  Pressable,
  ScrollView,
  Spinner,
  Stack,
  Text,
  useTheme,
} from '@pkgs/ui';
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

type Db = ReturnType<typeof usePatchDb>;

function useLoadPatch(
  db: Db,
  entityType: string,
  entityId: string,
  patchId: string
) {
  const { t } = useLingui();
  const [patch, setPatch] = useState<Patch | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const results = await db.read([
          { entityType, entityId, on: 'patches', limit: 500 },
        ]);
        const result = results[0];
        if (result === undefined) {
          if (!cancelled) setLoadError(t`Empty read result`);
          return;
        }
        const found = result.patches.find((p) => p.patchId === patchId);
        if (cancelled) return;
        if (found !== undefined) {
          setPatch(found);
        } else {
          setPatch(null);
          setLoadError(t`Patch not found`);
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
  }, [db, entityType, entityId, patchId, t]);

  return { patch, loading, loadError };
}

function useLoadParent(
  db: Db,
  patch: Patch | null,
  onNavigateToPatch: (p: Patch) => void
) {
  const [loadingParent, setLoadingParent] = useState(false);
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
  return { loadingParent, loadParent };
}

function MetaRow({
  metaKey,
  value,
  isLast,
}: {
  metaKey: string;
  value: string;
  isLast: boolean;
}) {
  const theme = useTheme();
  return (
    <Box>
      <Stack
        direction="horizontal"
        spacing={2}
        sx={{ px: 3, py: 2 }}
        align="center"
      >
        <Text
          variant="mono"
          style={{ fontSize: 11, color: theme.colors.tint, flex: 0.9 }}
          label={metaKey}
        />
        <Text
          variant="mono"
          style={{ fontSize: 11, flex: 1.4 }}
          numberOfLines={3}
          label={value}
        />
      </Stack>
      {!isLast ? <Divider /> : null}
    </Box>
  );
}

function MetaCard({
  patch,
  loadingParent,
  loadParent,
}: {
  patch: Patch;
  loadingParent: boolean;
  loadParent: () => Promise<void>;
}) {
  const { t } = useLingui();
  const metaRows: Array<readonly [string, string]> = useMemo(
    () => [
      ['patchId', patch.patchId],

      ['parentId', patch.parentId ?? 'null'],

      ['entityId', patch.entityId],

      ['entityType', patch.entityType],

      ['createdAt', patch.createdAt],

      ['recordedAt', patch.recordedAt],

      ['createdBy', patch.createdBy],

      ['sessionId', patch.sessionId],
    ],
    [patch]
  );
  return (
    <Card elevation={1} sx={{ mb: 3 }}>
      <Box sx={{ px: 3, py: 2 }}>
        <Text variant="bodyBold" label={t`Patch metadata`} />
      </Box>
      <Divider />
      {metaRows.map(([key, value], i) => (
        <MetaRow
          key={key}
          metaKey={key}
          value={String(value)}
          isLast={i === metaRows.length - 1}
        />
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
                  label={t`View parent patch`}
                />
              </Pressable>
            )}
          </Box>
        </>
      ) : null}
    </Card>
  );
}

function AttrRow({
  attrKey,
  value,
  isLast,
}: {
  attrKey: string;
  value: unknown;
  isLast: boolean;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Box>
      <Stack spacing={2} sx={{ px: 3, py: 2.5 }}>
        <Stack direction="horizontal" align="center" justify="space-between">
          <Text
            variant="mono"
            style={{ fontSize: 11, color: theme.colors.tint, flex: 1 }}
            label={attrKey}
          />
          <ValueKindBadge value={value} />
        </Stack>
        {value !== null && typeof value === 'object' ? (
          <JsonCollapsible title={t`Value`} value={value} />
        ) : (
          <FormattedInlineValue value={value} maxLen={500} />
        )}
      </Stack>
      {!isLast ? <Divider /> : null}
    </Box>
  );
}

function AttrsCard({ patch }: { patch: Patch }) {
  const { t } = useLingui();
  const attrEntries = useMemo(
    () =>
      Object.entries(patch.attributes).sort(([a], [b]) => a.localeCompare(b)),
    [patch]
  );
  return (
    <Card elevation={1}>
      <Box sx={{ px: 3, py: 2 }}>
        <Text variant="bodyBold" label={t`Patch attributes`} />
      </Box>
      <Divider />
      {attrEntries.map(([key, value], i) => (
        <AttrRow
          key={key}
          attrKey={key}
          value={value}
          isLast={i === attrEntries.length - 1}
        />
      ))}
    </Card>
  );
}

export function PatchDetailScreen({
  entityType,
  entityId,
  patchId,
  onNavigateToPatch,
}: PatchDetailScreenProps) {
  const { t } = useLingui();
  const db = usePatchDb();
  const { patch, loading, loadError } = useLoadPatch(
    db,
    entityType,
    entityId,
    patchId
  );
  const { loadingParent, loadParent } = useLoadParent(
    db,
    patch,
    onNavigateToPatch
  );

  if (loading) {
    return <LoadingState size="large" />;
  }

  if (loadError !== null || patch === null) {
    return (
      <Box sx={{ flex: 1, p: 4 }}>
        <ErrorState
          variant="compact"
          title={t`Patch not loaded`}
          body={loadError ?? t`Patch not found`}
        />
      </Box>
    );
  }

  return (
    <ScrollView sx={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <MetaCard
        patch={patch}
        loadingParent={loadingParent}
        loadParent={loadParent}
      />
      <AttrsCard patch={patch} />
    </ScrollView>
  );
}
