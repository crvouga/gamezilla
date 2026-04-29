import { assertUrl } from '@gamezilla/patch-db/assert-url';
import type { Patch, PatchesDbResult } from '@gamezilla/patch-db/interface';
import {
  ADMIN_METRIC_ENTITY_TYPE,
  PatchDbClientTransportHttpFetch,
} from '@gamezilla/patch-db/transport';
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
} from '@gamezilla/lib/ui';
import { useTheme } from '@gamezilla/lib/ui/theme';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

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
          label={attrKey}
        />
        <Text
          variant="mono"
          style={{ flex: 1, fontSize: 12, textAlign: 'right' }}
          label={formatAttrValue(value)}
        />
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
        label={`${connected ? 'Connected' : 'Connecting'} to ${url}`}
      />
    </Stack>
  );
}

type InspectorState = {
  urlInput: string;
  setUrlInput: (v: string) => void;
  connectedUrl: string | null;
  error: string | null;
  result: PatchesDbResult | null;
  handleConnect: () => void;
  handleDisconnect: () => void;
};

function useStoredUrl(
  setUrlInput: (v: string) => void,
  setConnectedUrl: (v: string | null) => void,
) {
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
  }, [setUrlInput, setConnectedUrl]);
}

function useInspectorPolling(
  connectedUrl: string | null,
  knownPatchesRef: React.MutableRefObject<Patch[]>,
  setResult: (r: PatchesDbResult | null) => void,
  setError: (e: string | null) => void,
) {
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

    void refresh();
    const pollTimer = setInterval(() => void refresh(), 5000);
    return () => {
      cancelled = true;
      clearInterval(pollTimer);
    };
  }, [connectedUrl, knownPatchesRef, setResult, setError]);
}

function useApiInspectorState(): InspectorState {
  const [urlInput, setUrlInput] = useState(DEFAULT_URL);
  const [connectedUrl, setConnectedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PatchesDbResult | null>(null);
  const knownPatchesRef = useRef<Patch[]>([]);

  useStoredUrl(setUrlInput, setConnectedUrl);

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

  const handleDisconnect = useCallback(() => {
    setConnectedUrl(null);
    setResult(null);
    setError(null);
  }, []);

  useInspectorPolling(connectedUrl, knownPatchesRef, setResult, setError);

  return {
    urlInput,
    setUrlInput,
    connectedUrl,
    error,
    result,
    handleConnect,
    handleDisconnect,
  };
}

function ConnectionCard({
  state,
}: {
  state: InspectorState;
}) {
  const { t } = useLingui();
  const {
    urlInput,
    setUrlInput,
    connectedUrl,
    result,
    handleConnect,
    handleDisconnect,
  } = state;
  return (
    <Card elevation={1} sx={{ p: 4 }}>
      <Stack spacing={3}>
        <Text variant="bodyBold" label={<Trans>Server Connection</Trans>} />
        <TextInput
          value={urlInput}
          onChangeText={setUrlInput}
          placeholder={t`https://...`}
          onSubmitEditing={handleConnect}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Stack direction="horizontal" spacing={2} align="center">
          <Button
            title={connectedUrl ? <Trans>Reconnect</Trans> : <Trans>Connect</Trans>}
            variant="solid"
            size="md"
            onPress={handleConnect}
          />
          {connectedUrl && (
            <Button
              title="Disconnect"
              variant="ghost"
              size="md"
              onPress={handleDisconnect}
            />
          )}
        </Stack>
        <ConnectionStatus connected={result !== null} url={connectedUrl} />
      </Stack>
    </Card>
  );
}

function ErrorCard({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <Card
      elevation={0}
      sx={{ p: 4 }}
      style={{
        borderColor: theme.colors.destructive + '44',
        backgroundColor: theme.colors.destructive + '0a',
      }}
    >
      <Text
        variant="body"
        style={{ color: theme.colors.destructive }}
        label={message}
      />
    </Card>
  );
}

function MetricsCard({ result }: { result: PatchesDbResult }) {
  const theme = useTheme();
  const entity = result.entities[0];
  if (!entity) return null;
  const adminAttrs = Object.entries(entity.attributes)
    .filter(([k]) => k.startsWith('admin/'))
    .sort(([a], [b]) => a.localeCompare(b));
  return (
    <Card elevation={1}>
      <Box sx={{ px: 4, py: 3 }}>
        <Text variant="bodyBold" label="Admin Metrics" />
        <Text
          variant="caption"
          style={{
            color: theme.colors.textSecondary,
            marginTop: 2,
          }}
          label={`${entity.entityType} / ${entity.entityId.slice(0, 16)} · ${result.patches.length} patches`}
        />
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
  );
}

function WaitingCard() {
  const theme = useTheme();
  return (
    <Card elevation={1} sx={{ p: 6 }}>
      <Stack spacing={3} align="center">
        <Spinner size="large" />
        <Text
          variant="caption"
          style={{ color: theme.colors.textSecondary }}
          label="Waiting for metrics from server..."
        />
      </Stack>
    </Card>
  );
}

function InspectorContent({ state }: { state: InspectorState }) {
  const { connectedUrl, error, result } = state;
  const hasEntity = result?.entities[0] !== undefined;
  if (hasEntity && result) return <MetricsCard result={result} />;
  if (connectedUrl !== null && error === null) return <WaitingCard />;
  return null;
}

export function ApiInspector() {
  const state = useApiInspectorState();
  return (
    <ScrollView sx={{ flex: 1, p: 4 }}>
      <Stack spacing={4}>
        <ConnectionCard state={state} />
        {state.error !== null && <ErrorCard message={state.error} />}
        <InspectorContent state={state} />
      </Stack>
    </ScrollView>
  );
}
