import {
  CLIENT_CONFIG_ENTITY_ID,
  CLIENT_CONFIG_ENTITY_TYPE,
  ClientConfigAttr,
} from '@gamezilla/domain/client-config/client-config-entities';
import { Box, Card, Text } from '@gamezilla/lib/ui';
import { useQuery } from '@gamezilla/patch-db/react';
import { Trans, useLingui } from '@lingui/react/macro';

export function ClientConfigEntityCard() {
  const { t } = useLingui();
  const { entities } = useQuery({
    entityType: CLIENT_CONFIG_ENTITY_TYPE,
    entityId: CLIENT_CONFIG_ENTITY_ID,
  });
  const entity = entities[0] ?? null;

  const attrs = entity?.attributes ?? {};
  const googleRaw = attrs[ClientConfigAttr.googleWebClientId.key];
  const googleLine =
    typeof googleRaw === 'string' && googleRaw.length > 0
      ? googleRaw
      : googleRaw === null
        ? t`null`
        : '—';

  const jsonPreview = JSON.stringify(attrs, null, 2);

  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text variant="bodyBold" label={<Trans>Local PatchDB (synced)</Trans>} />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={
          <Trans>Entity type clientConfig, id clientConfig__singleton</Trans>
        }
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
