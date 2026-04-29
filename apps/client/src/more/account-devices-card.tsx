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
import {
  formatDeviceListCaption,
  formatDeviceListTitle,
  formatTimestamp,
} from './account-format';

function CaptionLine({ label }: { label: string }) {
  return (
    <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
  );
}

function formatSessionCaption(
  sessionInfo: PrincipalSessionAggregate | undefined
): string {
  if (sessionInfo === undefined || sessionInfo.active === 0) {
    return 'No active session';
  }
  return `${String(sessionInfo.active)} active — expires ${formatTimestamp(sessionInfo.latestExpiresAt)}`;
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
  const theme = useTheme();
  const caption = [
    formatDeviceListCaption(p),
    formatSessionCaption(sessionInfo),
  ].join(' · ');
  return (
    <MenuRow
      title={formatDeviceListTitle(p)}
      caption={caption}
      trailing={
        <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          {p.isCurrentDevice ? (
            <Badge label="This device" color="info" size="sm" />
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
      accessibilityLabel={`Device ${formatDeviceListTitle(p)}`}
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
  const devicesLoading = principalsLoading || sessionsLoading;

  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text variant="bodyBold" label="Devices" />
      <CaptionLine label="Each install has its own principal id. Tap a row for full details." />
      {accountId !== null ? (
        <CopyToClipboardField
          label="Account ID"
          helperText="Server-side account; tap to copy"
          value={accountId}
        />
      ) : (
        <CaptionLine label="Sign in to link this device to a server account and see all principals for that account." />
      )}
      {devicesLoading ? (
        <CaptionLine label="Loading devices…" />
      ) : principals.length === 0 ? (
        <CaptionLine label="No principal data yet." />
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
