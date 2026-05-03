import type { AccountPrincipal } from '@gamezilla/client/auth/use-account-principals';
import type { PrincipalSessionAggregate } from '@gamezilla/client/auth/use-principals-sessions';
import {
  Badge,
  Box,
  Card,
  CopyToClipboardField,
  IconSymbol,
  MenuRow,
  Text,
} from '@gamezilla/lib/ui';
import { useTheme } from '@gamezilla/lib/ui/theme';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import {
  formatDeviceListCaption,
  formatDeviceListTitle,
  formatTimestamp,
} from './account-format';

function CaptionLine({ label }: { label: ReactNode }) {
  return (
    <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
  );
}

function formatSessionCaption(
  sessionInfo: PrincipalSessionAggregate | undefined,
  t: ReturnType<typeof useLingui>['t']
): string {
  if (sessionInfo === undefined || sessionInfo.active === 0) {
    return t`No active session`;
  }
  const active = sessionInfo.active;
  const expires = formatTimestamp(sessionInfo.latestExpiresAt);
  return t`${active} active — expires ${expires}`;
}

function DevicePrincipalMenuRow({
  principal: p,
  sessionInfo,
  onOpenDevice,
}: {
  principal: AccountPrincipal;
  sessionInfo: PrincipalSessionAggregate | undefined;
  onOpenDevice: (principalId: string) => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  const caption = [
    formatDeviceListCaption(p),
    formatSessionCaption(sessionInfo, t),
  ].join(' · ');
  return (
    <MenuRow
      title={formatDeviceListTitle(p)}
      caption={caption}
      trailing={
        <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          {p.isCurrentDevice ? (
            <Badge label={<Trans>This device</Trans>} color="info" size="sm" />
          ) : null}
          <IconSymbol
            name="chevron.right"
            size={20}
            color={theme.colors.icon}
          />
        </Box>
      }
      onPress={() => {
        onOpenDevice(p.entityId);
      }}
      accessibilityLabel={(() => {
        const deviceTitle = formatDeviceListTitle(p);
        return t`Device ${deviceTitle}`;
      })()}
    />
  );
}

export function AccountDevicesCard({
  accountId,
  principals,
  principalsLoading,
  sessionsByPrincipal,
  sessionsLoading,
  onOpenDevice,
}: {
  accountId: string | null;
  principals: AccountPrincipal[];
  principalsLoading: boolean;
  sessionsByPrincipal: Map<string, PrincipalSessionAggregate>;
  sessionsLoading: boolean;
  onOpenDevice: (principalId: string) => void;
}) {
  const { t } = useLingui();
  const devicesLoading = principalsLoading || sessionsLoading;

  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text variant="bodyBold" label={<Trans>Devices</Trans>} />
      <CaptionLine
        label={
          <Trans>
            Each install has its own principal id. Tap a row for full details.
          </Trans>
        }
      />
      {accountId !== null ? (
        <CopyToClipboardField
          label={<Trans>Account ID</Trans>}
          helperText={t`Server-side account; tap to copy`}
          value={accountId}
        />
      ) : (
        <CaptionLine
          label={
            <Trans>
              Sign in to link this device to a server account and see all
              principals for that account.
            </Trans>
          }
        />
      )}
      {devicesLoading ? (
        <CaptionLine label={<Trans>Loading devices…</Trans>} />
      ) : principals.length === 0 ? (
        <CaptionLine label={<Trans>No principal data yet.</Trans>} />
      ) : (
        <Box sx={{ gap: 0, pt: 2 }}>
          {principals.map((p) => (
            <DevicePrincipalMenuRow
              key={p.entityId}
              principal={p}
              sessionInfo={sessionsByPrincipal.get(p.entityId)}
              onOpenDevice={onOpenDevice}
            />
          ))}
        </Box>
      )}
    </Card>
  );
}
