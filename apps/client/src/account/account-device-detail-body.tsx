import type { AccountDevice } from '@gamezilla/client/auth/use-account-devices';
import type { AccountSessionAggregate } from '@gamezilla/client/auth/use-device-account-sessions';
import { Box, CopyToClipboardField, Text } from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import {
  EM_DASH,
  formatAppLine,
  formatModelLine,
  formatOsLine,
  formatTimestamp,
} from './account-format';

function CaptionLine({ label }: { label: ReactNode }) {
  return (
    <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
  );
}

function MetaPair({ label, value }: { label: ReactNode; value: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 140, gap: 1 }}>
      <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
      <Text variant="body" numberOfLines={4} label={value} />
    </Box>
  );
}

function DeviceDetailMetaGrid({ userDevice }: { userDevice: AccountDevice }) {
  return (
    <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
      <MetaPair
        label={<Trans>Platform</Trans>}
        value={userDevice.platform ?? EM_DASH}
      />
      <MetaPair label={<Trans>OS</Trans>} value={formatOsLine(userDevice)} />
      <MetaPair
        label={<Trans>Device name</Trans>}
        value={userDevice.deviceName ?? EM_DASH}
      />
      <MetaPair
        label={<Trans>Model</Trans>}
        value={formatModelLine(userDevice)}
      />
      <MetaPair label={<Trans>App</Trans>} value={formatAppLine(userDevice)} />
      <MetaPair
        label={<Trans>First seen</Trans>}
        value={formatTimestamp(userDevice.firstSeenAt ?? userDevice.createdAt)}
      />
      <MetaPair
        label={<Trans>Last seen</Trans>}
        value={formatTimestamp(userDevice.lastSeenAt)}
      />
      <MetaPair
        label={<Trans>Created</Trans>}
        value={formatTimestamp(userDevice.createdAt)}
      />
    </Box>
  );
}

function DeviceDetailUserAgent({ userAgent }: { userAgent: string }) {
  return (
    <Box sx={{ gap: 1 }}>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={<Trans>User agent</Trans>}
      />
      <Text variant="caption" selectable label={userAgent} />
    </Box>
  );
}

export function AccountDeviceDetailBody({
  userDevice,
  sessionInfo,
}: {
  userDevice: AccountDevice;
  sessionInfo: AccountSessionAggregate | undefined;
}) {
  const { t } = useLingui();
  const activeCount = sessionInfo?.active ?? 0;
  const latestExpires =
    sessionInfo !== undefined
      ? formatTimestamp(sessionInfo.latestExpiresAt)
      : '';
  const sessionLabel =
    sessionInfo === undefined || sessionInfo.active === 0
      ? t`No active session`
      : t`${activeCount} active session(s) — latest expires ${latestExpires}`;

  return (
    <Box sx={{ gap: 4 }}>
      <CopyToClipboardField
        label={<Trans>Device ID</Trans>}
        helperText={t`Stable per-device identifier; tap to copy`}
        value={userDevice.entityId}
      />
      <DeviceDetailMetaGrid userDevice={userDevice} />
      {userDevice.userAgent !== null ? (
        <DeviceDetailUserAgent userAgent={userDevice.userAgent} />
      ) : null}
      <CaptionLine label={sessionLabel} />
    </Box>
  );
}
