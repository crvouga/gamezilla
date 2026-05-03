import { useAuth } from '@gamezilla/client/auth/auth-context';
import {
  accountPrincipalFromEntity,
  useAccountPrincipals,
} from '@gamezilla/client/auth/use-account-principals';
import { useSessionsForPrincipals } from '@gamezilla/client/auth/use-principals-sessions';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { PRINCIPAL_ENTITY_TYPE } from '@gamezilla/domain/auth';
import { Trans } from '@lingui/react/macro';
import { Badge, Box, Card, ScreenBase, Text } from '@gamezilla/lib/ui';
import { useEntity } from '@gamezilla/patch-db/react';
import { t } from '@lingui/core/macro';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { AccountDeviceDetailBody } from './account-device-detail-body';
import { formatDeviceListTitle } from './account-format';

function normalizePrincipalId(
  raw: string | string[] | undefined
): string | null {
  if (raw === undefined) return null;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== 'string' || s.trim().length === 0) return null;
  return s.trim();
}

function useAccountDeviceDetailScreenState() {
  const nav = useBreadcrumbNav();
  const auth = useAuth();
  const params = useLocalSearchParams<{ principalId?: string | string[] }>();
  const principalId = normalizePrincipalId(params.principalId);
  const currentPid = auth.principalId;

  const { principals } = useAccountPrincipals(auth.accountId, currentPid);

  const fromList = useMemo(
    () =>
      principalId === null
        ? undefined
        : principals.find((p) => p.entityId === principalId),
    [principals, principalId]
  );

  const entityQuery = useMemo(
    () =>
      principalId === null
        ? { entityType: PRINCIPAL_ENTITY_TYPE, limit: 0 as const }
        : {
            entityType: PRINCIPAL_ENTITY_TYPE,
            entityId: principalId,
            limit: 1 as const,
          },
    [principalId]
  );

  const entity = useEntity(entityQuery);

  const principal = useMemo(() => {
    if (fromList !== undefined) return fromList;
    if (principalId === null || entity === null) return null;
    return accountPrincipalFromEntity(entity, currentPid);
  }, [fromList, principalId, entity, currentPid]);

  const { sessionsByPrincipal } = useSessionsForPrincipals(
    principalId === null ? [] : [principalId]
  );

  const sessionInfo =
    principalId === null ? undefined : sessionsByPrincipal.get(principalId);

  const title =
    principal !== null ? formatDeviceListTitle(principal) : t`Device`;

  return {
    nav,
    principalId,
    principal,
    sessionInfo,
    title,
  };
}

export function AccountDeviceDetailScreen() {
  const { nav, principalId, principal, sessionInfo, title } =
    useAccountDeviceDetailScreenState();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Spaces', onPress: nav('/') },
        { name: 'Settings', onPress: nav('/more') },
        { name: 'Account', onPress: nav('/more/account') },
        { name: title },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={{ ...sx, gap: 12 }}>
          {principalId === null ? (
            <Text variant="body" label={<Trans>Missing device id.</Trans>} />
          ) : principal === null ? (
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
                  label={formatDeviceListTitle(principal)}
                />
                {principal.isCurrentDevice ? (
                  <Badge label={t`This device`} color="info" size="sm" />
                ) : null}
              </Box>
              <AccountDeviceDetailBody
                principal={principal}
                sessionInfo={sessionInfo}
              />
            </Card>
          )}
        </Box>
      )}
    />
  );
}
