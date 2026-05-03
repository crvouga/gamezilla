import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import {
  CLIENT_CONFIG_ENTITY_ID,
  CLIENT_CONFIG_ENTITY_TYPE,
  ClientConfigAttr,
} from '@gamezilla/domain/client-config/client-config-entities';
import { Box, Card, ScreenBase, Text } from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEntities } from '@gamezilla/patch-db/react';

import { ClientConfigServerRefreshCard } from './client-config-server-refresh';

export function ClientConfigScreen() {
  const { t } = useLingui();
  const nav = useBreadcrumbNav();
  const { entities, loading } = useEntities({
    entityType: CLIENT_CONFIG_ENTITY_TYPE,
    entityId: CLIENT_CONFIG_ENTITY_ID,
  });
  const entity = entities[0] ?? null;

  const attrs = entity?.attributes ?? {};
  const googleRaw = attrs[ClientConfigAttr.googleWebClientId];
  const googleLine =
    typeof googleRaw === 'string' && googleRaw.length > 0
      ? googleRaw
      : googleRaw === null
        ? t`null`
        : loading
          ? '…'
          : '—';

  const jsonPreview = JSON.stringify(attrs, null, 2);

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Developer</Trans>, onPress: nav('/more/developer') },
        {
          name: <Trans>Client config</Trans>,
          subtitle: <Trans>Singleton entity + server refresh</Trans>,
        },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={{ ...sx, gap: 12 }}>
          <Card elevation={1} sx={{ p: 4, gap: 3 }}>
            <Text
              variant="bodyBold"
              label={<Trans>Local PatchDB (synced)</Trans>}
            />
            <Text
              variant="caption"
              sx={{ color: 'textSecondary' }}
              label={
                <Trans>
                  Entity type clientConfig, id clientConfig__singleton
                </Trans>
              }
            />
            <Box sx={{ gap: 1 }}>
              <Text
                variant="label"
                label={<Trans>Google web client ID</Trans>}
              />
              <Text variant="mono" selectable label={googleLine} />
            </Box>
            <Text
              variant="label"
              label={<Trans>All attributes (JSON)</Trans>}
            />
            <Text variant="mono" selectable label={jsonPreview} />
          </Card>

          <ClientConfigServerRefreshCard />
        </Box>
      )}
    />
  );
}
