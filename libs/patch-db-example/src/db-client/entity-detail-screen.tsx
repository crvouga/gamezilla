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
import type { Entity, Patch } from '@gamezilla/patch-db/interface';
import { usePatchDb, useQueryOne } from '@gamezilla/patch-db/react';
import { useLingui } from '@lingui/react/macro';
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

function useEntityPatches(entityType: string, entityId: string) {
  const db = usePatchDb();
  const [patches, setPatches] = useState<Patch[]>([]);
  const [loadingPatches, setLoadingPatches] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);

  const loadPatches = useCallback(async () => {
    setLoadingPatches(true);
    setPatchError(null);
    try {
      const results = await db.read([
        { entityType, entityId, on: 'patches', limit: 500 },
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

  return { patches, loadingPatches, patchError, loadPatches };
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
            style={{
              fontSize: 11,
              color: theme.colors.tint,
              flex: 1,
            }}
            label={attrKey}
          />
          <ValueKindBadge value={value} />
        </Stack>
        {value !== null && typeof value === 'object' ? (
          <JsonCollapsible title={t`Value`} value={value} />
        ) : (
          <Box sx={{ alignSelf: 'stretch' }}>
            <FormattedInlineValue value={value} maxLen={400} />
          </Box>
        )}
      </Stack>
      {!isLast ? <Divider /> : null}
    </Box>
  );
}

function AttributesPane({ entity }: { entity: Entity }) {
  const attrEntries = useMemo(
    () =>
      Object.entries(entity.attributes).sort(([a], [b]) => a.localeCompare(b)),
    [entity]
  );

  return (
    <ScrollView sx={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
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
          <AttrRow
            key={key}
            attrKey={key}
            value={value}
            isLast={i === attrEntries.length - 1}
          />
        ))}
      </Card>
    </ScrollView>
  );
}

function PatchRowCard({
  patch,
  onPress,
}: {
  patch: Patch;
  onPress: () => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  const createdAt = patch.createdAt;
  const createdBy = patch.createdBy || '—';
  return (
    <Pressable onPress={onPress}>
      <Card elevation={1} sx={{ mb: 2, p: 3 }}>
        <Stack spacing={1}>
          <Text
            variant="mono"
            style={{ fontSize: 11 }}
            numberOfLines={1}
            label={patch.patchId}
          />
          <Text
            variant="caption"
            style={{ color: theme.colors.textSecondary }}
            label={t`${createdAt} · ${createdBy}`}
          />
        </Stack>
      </Card>
    </Pressable>
  );
}

function PatchesPane({
  patches,
  loadingPatches,
  patchError,
  onSelectPatch,
}: {
  patches: Patch[];
  loadingPatches: boolean;
  patchError: string | null;
  onSelectPatch: (p: Patch) => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  if (loadingPatches) {
    return (
      <Box sx={{ p: 6, alignItems: 'center' }}>
        <Spinner size="large" />
      </Box>
    );
  }
  if (patchError !== null) {
    return (
      <Box sx={{ p: 4 }}>
        <Text
          variant="body"
          style={{ color: theme.colors.destructive }}
          label={patchError}
        />
      </Box>
    );
  }
  return (
    <FlatList
      data={patches}
      keyExtractor={(p) => p.patchId}
      style={theme.sx({ flex: 1 })}
      sx={{ p: 3 }}
      renderItem={({ item }) => (
        <PatchRowCard patch={item} onPress={() => onSelectPatch(item)} />
      )}
      ListEmptyComponent={
        <Text
          variant="body"
          style={{ opacity: 0.7 }}
          label={t`No patches for this entity.`}
        />
      }
    />
  );
}

function LoadingEntity() {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Box sx={{ p: 6, alignItems: 'center' }}>
      <Spinner size="large" />
      <Text
        variant="caption"
        style={{ marginTop: 12, color: theme.colors.textSecondary }}
        label={t`Loading entity…`}
      />
    </Box>
  );
}

export function EntityDetailScreen({
  entityType,
  entityId,
  onSelectPatch,
}: EntityDetailScreenProps) {
  const { t } = useLingui();
  const entity = useQueryOne({ entityType, entityId });
  const [tab, setTab] = useState<'attrs' | 'patches'>('attrs');
  const { patches, loadingPatches, patchError, loadPatches } = useEntityPatches(
    entityType,
    entityId
  );

  useEffect(() => {
    if (tab === 'patches') void loadPatches();
  }, [tab, loadPatches]);

  return (
    <Box sx={{ flex: 1 }}>
      <Box sx={{ px: 3, py: 2 }}>
        <SegmentedControl
          segments={[
            { key: 'attrs', label: t`Attributes` },
            { key: 'patches', label: t`Patches` },
          ]}
          selected={tab}
          onSelect={(k) => setTab(k as 'attrs' | 'patches')}
        />
      </Box>
      <Box sx={{ flex: 1 }}>
        {tab === 'attrs' ? (
          entity === null ? (
            <LoadingEntity />
          ) : (
            <AttributesPane entity={entity} />
          )
        ) : (
          <PatchesPane
            patches={patches}
            loadingPatches={loadingPatches}
            patchError={patchError}
            onSelectPatch={onSelectPatch}
          />
        )}
      </Box>
    </Box>
  );
}
