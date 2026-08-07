import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@pkgs/sync-engine/client';
import { Box, Card, Text } from '@pkgs/ui';
import {
  CLIENT_CONFIG_ENTITY_ID,
  ClientConfigAttr,
} from '../shared/client-config-entities';

import { clientConfigRowQuery } from './client-config-queries';

export function ClientConfigEntityCard() {
  const { t } = useLingui();
  const { rows } = useQuery(clientConfigRowQuery(CLIENT_CONFIG_ENTITY_ID));
  const row = rows[0] ?? null;

  const googleRaw = row?.google_web_client_id;
  const googleLine =
    typeof googleRaw === 'string' && googleRaw.length > 0
      ? googleRaw
      : googleRaw === null
        ? t`null`
        : '—';

  const attrs = {
    [ClientConfigAttr.googleWebClientId.key]: googleRaw ?? null,
  };
  const jsonPreview = JSON.stringify(attrs, null, 2);

  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text
        variant="bodyBold"
        label={<Trans>Local sync (client_config)</Trans>}
      />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={<Trans>Table client_config, id client-config__singleton</Trans>}
      />
      <Box sx={{ gap: 1 }}>
        <Text variant="label" label={<Trans>Google web client ID</Trans>} />
        <Text variant="mono" selectable label={googleLine} />
      </Box>
      <Text variant="label" label={<Trans>All attributes (JSON)</Trans>} />
      <Text variant="mono" selectable label={jsonPreview} />
    </Card>
  );
}
