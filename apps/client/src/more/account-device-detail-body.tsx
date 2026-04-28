import type { AccountPrincipal } from '@gamezilla/client/auth/use-account-principals';
import type { PrincipalSessionAggregate } from '@gamezilla/client/auth/use-principals-sessions';
import { Box, CopyToClipboardField, Text } from '@gamezilla/lib/ui';
import {
  EM_DASH,
  formatAppLine,
  formatModelLine,
  formatOsLine,
  formatTimestamp,
} from './account-format';

function CaptionLine({ label }: { label: string }) {
  return (
    <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
  );
}

function MetaPair({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 140, gap: 1 }}>
      <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
      <Text variant="body" numberOfLines={4} label={value} />
    </Box>
  );
}

function DeviceRowMetaGrid({ principal }: { principal: AccountPrincipal }) {
  return (
    <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
      <MetaPair label="Platform" value={principal.platform ?? EM_DASH} />
      <MetaPair label="OS" value={formatOsLine(principal)} />
      <MetaPair
        label="Device name"
        value={principal.deviceName ?? EM_DASH}
      />
      <MetaPair label="Model" value={formatModelLine(principal)} />
      <MetaPair label="App" value={formatAppLine(principal)} />
      <MetaPair
        label="First seen"
        value={formatTimestamp(principal.firstSeenAt ?? principal.createdAt)}
      />
      <MetaPair label="Last seen" value={formatTimestamp(principal.lastSeenAt)} />
      <MetaPair label="Created" value={formatTimestamp(principal.createdAt)} />
    </Box>
  );
}

function DeviceRowUserAgent({ userAgent }: { userAgent: string }) {
  return (
    <Box sx={{ gap: 1 }}>
      <Text variant="caption" sx={{ color: 'textSecondary' }} label="User agent" />
      <Text variant="caption" selectable label={userAgent} />
    </Box>
  );
}

export function AccountDeviceDetailBody({
  principal,
  sessionInfo,
}: {
  principal: AccountPrincipal;
  sessionInfo: PrincipalSessionAggregate | undefined;
}) {
  const sessionLabel =
    sessionInfo === undefined || sessionInfo.active === 0
      ? 'No active session'
      : `${String(sessionInfo.active)} active session(s) — latest expires ${formatTimestamp(sessionInfo.latestExpiresAt)}`;

  return (
    <Box sx={{ gap: 4 }}>
      <CopyToClipboardField
        label="Principal ID"
        helperText="Stable per-device identifier; tap to copy"
        value={principal.entityId}
      />
      <DeviceRowMetaGrid principal={principal} />
      {principal.userAgent !== null ? (
        <DeviceRowUserAgent userAgent={principal.userAgent} />
      ) : null}
      <CaptionLine label={sessionLabel} />
    </Box>
  );
}
