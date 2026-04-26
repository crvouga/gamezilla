import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import {
  CLIENT_CONFIG_ENTITY_ID,
  CLIENT_CONFIG_ENTITY_TYPE,
  ClientConfigAttr,
} from '@gamezilla/domain/auth';
import { Box, Card, ScreenBase, Text } from '@gamezilla/lib/ui';
import { useEntities } from '@gamezilla/patch-db/react';

import { ClientConfigServerRefreshCard } from '@gamezilla/client/more/client-config-server-refresh';

export function ClientConfigScreen() {
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
        ? 'null'
        : loading
          ? '…'
          : '—';

  const jsonPreview = JSON.stringify(attrs, null, 2);

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Spaces', onPress: nav('/') },
        { name: 'Settings', onPress: nav('/more') },
        { name: 'Developer', onPress: nav('/more/developer') },
        {
          name: 'Client config',
          subtitle: 'Singleton entity + server refresh',
        },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={{ ...sx, gap: 12 }}>
          <Card elevation={1} sx={{ p: 4, gap: 3 }}>
            <Text variant="bodyBold" label="Local PatchDB (synced)" />
            <Text
              variant="caption"
              sx={{ color: 'textSecondary' }}
              label="Entity type clientConfig, id clientConfig__singleton"
            />
            <Box sx={{ gap: 1 }}>
              <Text variant="label" label="Google web client ID" />
              <Text variant="mono" selectable label={googleLine} />
            </Box>
            <Text variant="label" label="All attributes (JSON)" />
            <Text variant="mono" selectable label={jsonPreview} />
          </Card>

          <ClientConfigServerRefreshCard />
        </Box>
      )}
    />
  );
}
