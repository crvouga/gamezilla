import { createTypedApiRpcClient } from '../typed-api-rpc-client';
import { useConfigService } from '@gamezilla/auth/client/runtime-hooks';
import type { ConfigService } from '@gamezilla/auth/client/config-service-types';
import { useAsync, type AsyncRunContext } from '@gamezilla/lib/async/use-async';
import { Button, Card, Text } from '@gamezilla/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback } from 'react';

async function postClientConfigRefresh(
  configService: ConfigService,
  ctx: AsyncRunContext
): Promise<void> {
  const apiUrl = configService.getApiUrl();
  const client = createTypedApiRpcClient(apiUrl);
  const res = await client['client-config']['refresh'].$post(undefined, {
    init: { signal: ctx.signal },
  });
  const text = await res.text();
  if (!res.ok) {
    const status = String(res.status);
    throw new Error(
      text.length > 0 ? `HTTP ${status}: ${text}` : `HTTP ${status}`
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
}

export function ClientConfigServerRefreshCard() {
  const { t } = useLingui();
  const configService = useConfigService();
  const refreshServer = useAsync<void, []>({
    operation: useCallback(
      (ctx: AsyncRunContext) => postClientConfigRefresh(configService, ctx),
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
        title={refreshServer.loading ? t`Refreshing…` : t`Refresh on server`}
        onPress={() => {
          void refreshServer.run();
        }}
        disabled={refreshServer.loading}
      />
      {refreshServer.state.status === 'success' ? (
        <Text
          variant="caption"
          label={t`Server client config updated. Local view updates after the next PatchDB sync.`}
        />
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
