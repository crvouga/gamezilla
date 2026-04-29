import type { AccountPrincipal } from '@gamezilla/client/auth/use-account-principals';
import type { PrincipalSessionAggregate } from '@gamezilla/client/auth/use-principals-sessions';
import { Box, CopyToClipboardField, Text } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
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

function DeviceRowMetaGrid({ principal }: { principal: AccountPrincipal }) {
  return (
    <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
      <MetaPair label={<Trans>Platform</Trans>} value={principal.platform ?? EM_DASH} />
      <MetaPair label={<Trans>OS</Trans>} value={formatOsLine(principal)} />
      <MetaPair
        label={<Trans>Device name</Trans>}
        value={principal.deviceName ?? EM_DASH}
      />
      <MetaPair label={<Trans>Model</Trans>} value={formatModelLine(principal)} />
      <MetaPair label={<Trans>App</Trans>} value={formatAppLine(principal)} />
      <MetaPair
        label={<Trans>First seen</Trans>}
        value={formatTimestamp(principal.firstSeenAt ?? principal.createdAt)}
      />
      <MetaPair label={<Trans>Last seen</Trans>} value={formatTimestamp(principal.lastSeenAt)} />
      <MetaPair label={<Trans>Created</Trans>} value={formatTimestamp(principal.createdAt)} />
    </Box>
  );
}

function DeviceRowUserAgent({ userAgent }: { userAgent: string }) {
  return (
    <Box sx={{ gap: 1 }}>
      <Text variant="caption" sx={{ color: 'textSecondary' }} label={<Trans>User agent</Trans>} />
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
  const { t } = useLingui();
  const sessionLabel =
    sessionInfo === undefined || sessionInfo.active === 0
      ? t`No active session`
      : t`${sessionInfo.active} active session(s) — latest expires ${formatTimestamp(sessionInfo.latestExpiresAt)}`;

  return (
    <Box sx={{ gap: 4 }}>
      <CopyToClipboardField
        label={<Trans>Principal ID</Trans>}
        helperText={t`Stable per-device identifier; tap to copy`}
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
