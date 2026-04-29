import { createGamezillaApiClient } from '@gamezilla/client/api/hc';
import {
  type AsyncRunContext,
  useAsync,
} from '@gamezilla/lib/async/use-async';
import { ConfigServiceToken } from '@gamezilla/domain/config/config-service';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import { Button, Card, Text } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import { useCallback } from 'react';

const SERVER_REFRESH_SUCCESS =
  'Server client config updated. Local view updates after the next PatchDB sync.';

export function ClientConfigServerRefreshCard() {
  const configService = useDependency(ConfigServiceToken);
  const refreshServer = useAsync<void, []>({
    operation: useCallback(
      async ({ signal }: AsyncRunContext) => {
        const apiUrl = configService.getApiUrl();
        const client = createGamezillaApiClient(apiUrl);
        const res = await client['client-config']['refresh'].$post(undefined, {
          init: { signal },
        });
        const text = await res.text();
        if (!res.ok) {
          throw new Error(
            text.length > 0
              ? `HTTP ${String(res.status)}: ${text}`
              : `HTTP ${String(res.status)}`
          );
        }
        let parsed: unknown;
        try {
          parsed = text.length > 0 ? (JSON.parse(text) as unknown) : null;
        } catch {
          throw new Error('Response was not JSON');
        }
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          (parsed as { ok?: unknown }).ok !== true
        ) {
          throw new Error('Expected { ok: true }');
        }
      },
      [configService]
    ),
  });

  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text variant="bodyBold" label={<Trans>Server</Trans>} />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={
          <Trans>
            POST /client-config/refresh writes the Worker secret into PatchDB on
            the server (deploy pipeline uses this too).
          </Trans>
        }
      />
      <Button
        title={refreshServer.loading ? 'Refreshing…' : 'Refresh on server'}
        onPress={() => {
          void refreshServer.run();
        }}
        disabled={refreshServer.loading}
      />
      {refreshServer.state.status === 'success' ? (
        <Text variant="caption" label={SERVER_REFRESH_SUCCESS} />
      ) : null}
      {refreshServer.error !== null ? (
        <Text
          variant="caption"
          sx={{ color: 'destructive' }}
          label={refreshServer.error.message}
        />
      ) : null}
    </Card>
  );
}
