import { useAuth } from '@gamezilla/client/auth/auth-context';
import {
  accountDeviceFromEntity,
  useAccountDevices,
} from '@gamezilla/client/auth/use-account-devices';
import { useSessionsForDevices } from '@gamezilla/client/auth/use-device-account-sessions';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { DEVICE_ENTITY_TYPE } from '@gamezilla/domain/auth';
import { Badge, Box, Card, ScreenBase, Text } from '@gamezilla/lib/ui';
import { useQueryOne } from '@gamezilla/patch-db/react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { type Href, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { AccountDeviceDetailBody } from './account-device-detail-body';
import { formatDeviceListTitle } from './account-format';

function normalizeDeviceId(raw: string | string[] | undefined): string | null {
  if (raw === undefined) return null;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== 'string' || s.trim().length === 0) return null;
  return s.trim();
}

function useAccountDeviceDetailScreenState() {
  const nav = useBreadcrumbNav();
  const auth = useAuth();
  const params = useLocalSearchParams<{ deviceId?: string | string[] }>();
  const deviceId = normalizeDeviceId(params.deviceId);
  const currentPid = auth.deviceId;

  const { devices } = useAccountDevices(auth.accountId, currentPid);

  const fromList = useMemo(
    () =>
      deviceId === null
        ? undefined
        : devices.find((p) => p.entityId === deviceId),
    [devices, deviceId]
  );

  const entityQuery = useMemo(
    () =>
      deviceId === null
        ? { entityType: DEVICE_ENTITY_TYPE, limit: 0 as const }
        : {
            entityType: DEVICE_ENTITY_TYPE,
            entityId: deviceId,
            limit: 1 as const,
          },
    [deviceId]
  );

  const entity = useQueryOne(entityQuery);

  const userDevice = useMemo(() => {
    if (fromList !== undefined) return fromList;
    if (deviceId === null || entity === null) return null;
    return accountDeviceFromEntity(entity, currentPid);
  }, [fromList, deviceId, entity, currentPid]);

  const { sessionsByDevice } = useSessionsForDevices(
    deviceId === null ? [] : [deviceId]
  );

  const sessionInfo =
    deviceId === null ? undefined : sessionsByDevice.get(deviceId);

  const title =
    userDevice !== null ? formatDeviceListTitle(userDevice) : t`Device`;

  return {
    nav,
    deviceId,
    userDevice,
    sessionInfo,
    title,
  };
}

export function AccountDeviceDetailScreen() {
  const { nav, deviceId, userDevice, sessionInfo, title } =
    useAccountDeviceDetailScreenState();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Spaces', onPress: nav('/') },
        { name: 'Settings', onPress: nav('/more') },
        {
          name: 'Account',
          onPress: nav('/more/account' as Href),
        },
        { name: title },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={{ ...sx, gap: 12 }}>
          {deviceId === null ? (
            <Text variant="body" label={<Trans>Missing device id.</Trans>} />
          ) : userDevice === null ? (
            <Text
              variant="body"
              label={
                <Trans>
                  This device was not found. It may have been removed or is not
                  visible for the current account.
                </Trans>
              }
            />
          ) : (
            <Card elevation={1} sx={{ p: 4, gap: 3 }}>
              <Box
                sx={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Text
                  variant="heading"
                  numberOfLines={2}
                  label={formatDeviceListTitle(userDevice)}
                />
                {userDevice.isCurrentDevice ? (
                  <Badge label={t`This device`} color="info" size="sm" />
                ) : null}
              </Box>
              <AccountDeviceDetailBody
                userDevice={userDevice}
                sessionInfo={sessionInfo}
              />
            </Card>
          )}
        </Box>
      )}
    />
  );
}
