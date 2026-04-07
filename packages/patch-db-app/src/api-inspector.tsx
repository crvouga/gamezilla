import { assertUrl } from '@gamezilla/patch-db/assert-url';
import type { Patch, PatchesDbResult } from '@gamezilla/patch-db/interface';
import {
  ADMIN_METRIC_ENTITY_TYPE,
  PatchDbClientTransportHttpFetch,
} from '@gamezilla/patch-db/transport';
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Box,
  Button,
  Card,
  Divider,
  ScrollView,
  Spinner,
  Stack,
  StatusDot,
  Text,
  TextInput,
} from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/ui';

const URL_STORAGE_KEY = 'patchdb-inspector-sync-url';
const DEFAULT_URL = 'http://localhost:5001';

function formatAttrValue(value: unknown): string {
  if (value === null || value === undefined) return '\u2014';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function AttributeRow({
  attrKey,
  value,
  isLast,
}: {
  attrKey: string;
  value: unknown;
  isLast: boolean;
}) {
  const theme = useTheme();
  return (
    <Box>
      <Stack
        direction="horizontal"
        spacing={3}
        sx={{ px: 4, py: 2.5 }}
        align="center"
      >
        <Text
          variant="mono"
          style={{
            flex: 1,
            fontSize: 12,
            color: theme.colors.tint,
          }}
        >
          {attrKey}
        </Text>
        <Text
          variant="mono"
          style={{ flex: 1, fontSize: 12, textAlign: 'right' }}
        >
          {formatAttrValue(value)}
        </Text>
      </Stack>
      {!isLast && <Divider />}
    </Box>
  );
}

function ConnectionStatus({
  connected,
  url,
}: {
  connected: boolean;
  url: string | null;
}) {
  const theme = useTheme();
  if (!url) return null;
  return (
    <Stack direction="horizontal" spacing={2} align="center" sx={{ py: 1 }}>
      <StatusDot status={connected ? 'online' : 'warning'} size={8} />
      <Text
        variant="caption"
        style={{ color: theme.colors.textSecondary }}
      >
        {connected ? 'Connected' : 'Connecting'} to {url}
      </Text>
    </Stack>
  );
}

export function ApiInspector() {
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
  const adminAttrs = entity
    ? Object.entries(entity.attributes)
        .filter(([k]) => k.startsWith('admin/'))
        .sort(([a], [b]) => a.localeCompare(b))
    : [];

  return (
    <ScrollView sx={{ flex: 1, p: 4 }}>
      <Stack spacing={4}>
        <Card elevation={1} sx={{ p: 4 }}>
          <Stack spacing={3}>
            <Text variant="bodyBold">Server Connection</Text>
            <TextInput
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="https://..."
              onSubmitEditing={handleConnect}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Stack direction="horizontal" spacing={2} align="center">
              <Button
                title={connectedUrl ? 'Reconnect' : 'Connect'}
                variant="solid"
                size="md"
                onPress={handleConnect}
              />
              {connectedUrl && (
                <Button
                  title="Disconnect"
                  variant="ghost"
                  size="md"
                  onPress={() => {
                    setConnectedUrl(null);
                    setResult(null);
                    setError(null);
                  }}
                />
              )}
            </Stack>
            <ConnectionStatus
              connected={result !== null}
              url={connectedUrl}
            />
          </Stack>
        </Card>

        {error !== null && (
          <Card
            elevation={0}
            sx={{ p: 4 }}
            style={{
              borderColor: theme.colors.destructive + '44',
              backgroundColor: theme.colors.destructive + '0a',
            }}
          >
            <Text variant="body" style={{ color: theme.colors.destructive }}>
              {error}
            </Text>
          </Card>
        )}

        {entity !== null && entity !== undefined ? (
          <Card elevation={1}>
            <Box sx={{ px: 4, py: 3 }}>
              <Text variant="bodyBold">Admin Metrics</Text>
              <Text
                variant="caption"
                style={{
                  color: theme.colors.textSecondary,
                  marginTop: 2,
                }}
              >
                {entity.entityType} / {entity.entityId.slice(0, 16)} &middot;{' '}
                {result?.patches.length ?? 0} patches
              </Text>
            </Box>
            <Divider />
            {adminAttrs.map(([key, value], i) => (
              <AttributeRow
                key={key}
                attrKey={key}
                value={value}
                isLast={i === adminAttrs.length - 1}
              />
            ))}
          </Card>
        ) : connectedUrl !== null && error === null ? (
          <Card elevation={1} sx={{ p: 6 }}>
            <Stack spacing={3} align="center">
              <Spinner size="large" />
              <Text
                variant="caption"
                style={{ color: theme.colors.textSecondary }}
              >
                Waiting for metrics from server...
              </Text>
            </Stack>
          </Card>
        ) : null}
      </Stack>
    </ScrollView>
  );
}
