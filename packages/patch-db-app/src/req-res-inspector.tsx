import { assertUrl } from '@gamezilla/patch-db/assert-url';
import type { Patch, PatchesDbResult } from '@gamezilla/patch-db/interface';
import {
  ADMIN_METRIC_ENTITY_TYPE,
  PatchDbClientTransportHttpFetch,
} from '@gamezilla/patch-db/transport';
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Box, Button, Card, ScrollView, Spinner, Stack, Text, TextInput } from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/ui';

const URL_STORAGE_KEY = 'patchdb-inspector-sync-url';
const DEFAULT_URL = 'http://localhost:5001';

function formatAttrValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function ReqResInspector() {
  const [urlInput, setUrlInput] = useState(DEFAULT_URL);
  const [connectedUrl, setConnectedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PatchesDbResult | null>(null);
  const knownPatchesRef = useRef<Patch[]>([]);
  const theme = useTheme();

  useEffect(() => {
    void AsyncStorage.getItem(URL_STORAGE_KEY).then((stored) => {
      if (typeof stored === 'string' && stored.length > 0) {
        setUrlInput(stored);
        try {
          assertUrl(stored);
          setConnectedUrl(stored);
        } catch {
          // invalid stored url
        }
      }
    });
  }, []);

  const handleConnect = useCallback(() => {
    const trimmed = urlInput.trim();
    setError(null);
    try {
      assertUrl(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setConnectedUrl(null);
      return;
    }
    knownPatchesRef.current = [];
    setResult(null);
    setConnectedUrl(trimmed);
    void AsyncStorage.setItem(URL_STORAGE_KEY, trimmed);
  }, [urlInput]);

  useEffect(() => {
    if (connectedUrl === null) return;

    const transport = new PatchDbClientTransportHttpFetch(connectedUrl);
    let cancelled = false;

    const refresh = async () => {
      if (cancelled) return;
      try {
        const results = await transport.read([
          {
            entityType: ADMIN_METRIC_ENTITY_TYPE,
            knownPatches: knownPatchesRef.current,
          },
        ]);
        if (cancelled) return;
        const first = results[0];
        if (first !== null && first !== undefined) {
          knownPatchesRef.current = first.patches;
          setResult(first);
          setError(null);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    };

    const unsub = transport.subscribe(() => {
      void refresh();
    });
    void refresh();

    return () => {
      cancelled = true;
      unsub();
    };
  }, [connectedUrl]);

  const entity = result?.entities[0];

  return (
    <ScrollView sx={{ flex: 1, p: 4, gap: 4 }}>
      <Stack spacing={3}>
        <Text variant="caption">Req Res URL</Text>
        <TextInput
          value={urlInput}
          onChangeText={setUrlInput}
          placeholder="https://…"
          onSubmitEditing={handleConnect}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Button
          title="Connect"
          variant="solid"
          size="md"
          onPress={handleConnect}
        />
      </Stack>

      {error !== null ? (
        <Card sx={{ p: 3, mt: 3 }}>
          <Text variant="body" style={{ color: theme.colors.destructive }}>
            {error}
          </Text>
        </Card>
      ) : null}

      {entity !== null && entity !== undefined ? (
        <Card sx={{ mt: 3, p: 0 }} elevation={1}>
          <Stack
            direction="horizontal"
            sx={{ px: 4, py: 2 }}
            style={{
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}
          >
            <Text variant="label" style={{ flex: 1 }}>Attribute</Text>
            <Text variant="label" style={{ flex: 1 }}>Value</Text>
          </Stack>

          {Object.entries(entity.attributes)
            .filter(([k]) => k.startsWith('admin/'))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => (
              <Stack
                key={key}
                direction="horizontal"
                sx={{ px: 4, py: 2 }}
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border + '33',
                }}
              >
                <Text variant="mono" style={{ flex: 1, fontSize: 12, color: theme.colors.tint }}>
                  {key}
                </Text>
                <Text variant="mono" style={{ flex: 1, fontSize: 12 }}>
                  {formatAttrValue(value)}
                </Text>
              </Stack>
            ))}

          <Box sx={{ px: 4, py: 2 }}>
            <Text variant="caption">
              entity {entity.entityId} · {entity.entityType} · patches: {result?.patches.length ?? 0}
            </Text>
          </Box>
        </Card>
      ) : connectedUrl !== null && error === null ? (
        <Stack direction="horizontal" spacing={2} align="center" sx={{ mt: 3 }}>
          <Spinner size="small" />
          <Text variant="caption">Waiting for metrics from server…</Text>
        </Stack>
      ) : null}
    </ScrollView>
  );
}
