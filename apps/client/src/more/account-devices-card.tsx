import type { AccountPrincipal } from '@gamezilla/client/auth/use-account-principals';
import type { PrincipalProfileSummary } from '@gamezilla/client/auth/use-principals-profiles';
import type { PrincipalSessionAggregate } from '@gamezilla/client/auth/use-principals-sessions';
import { ProfileDiceBearAvatar } from '@gamezilla/client/profile/profile-dicebear-avatar';
import { resolveAvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { ProfileAttr } from '@gamezilla/domain/profile/profile-entities';
import {
  Badge,
  Box,
  Card,
  CopyToClipboardField,
  Text,
} from '@gamezilla/lib/ui';
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

function DeviceRowHeader({
  principal,
  profile,
  profilesLoading,
}: {
  principal: AccountPrincipal;
  profile: PrincipalProfileSummary | undefined;
  profilesLoading: boolean;
}) {
  const displayName =
    profile?.displayName !== null &&
    profile?.displayName !== undefined &&
    profile.displayName.length > 0
      ? profile.displayName
      : 'No display name';

  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <ProfileDiceBearAvatar
        config={
          profile?.avatarConfig ??
          resolveAvatarConfig(
            undefined,
            principal.entityId,
            ProfileAttr.avatarConfig
          )
        }
        fallbackSeed={principal.entityId}
        size={48}
        loading={profilesLoading}
      />
      <Box sx={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Box
          sx={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Text variant="bodyBold" numberOfLines={1} label={displayName} />
          {principal.isCurrentDevice ? (
            <Badge label="This device" color="info" size="sm" />
          ) : null}
        </Box>
      </Box>
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

function DeviceRow({
  principal,
  profile,
  sessionInfo,
  profilesLoading,
}: {
  principal: AccountPrincipal;
  profile: PrincipalProfileSummary | undefined;
  sessionInfo: PrincipalSessionAggregate | undefined;
  profilesLoading: boolean;
}) {
  const sessionLabel =
    sessionInfo === undefined || sessionInfo.active === 0
      ? 'No active session'
      : `${String(sessionInfo.active)} active session(s) — latest expires ${formatTimestamp(sessionInfo.latestExpiresAt)}`;

  return (
    <Box sx={{ gap: 3, pb: 4 }}>
      <DeviceRowHeader
        principal={principal}
        profile={profile}
        profilesLoading={profilesLoading}
      />
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

export function AccountDevicesCard({
  accountId,
  principals,
  principalsLoading,
  profilesByPrincipal,
  profilesLoading,
  sessionsByPrincipal,
  sessionsLoading,
}: {
  accountId: string | null;
  principals: AccountPrincipal[];
  principalsLoading: boolean;
  profilesByPrincipal: Map<string, PrincipalProfileSummary>;
  profilesLoading: boolean;
  sessionsByPrincipal: Map<string, PrincipalSessionAggregate>;
  sessionsLoading: boolean;
}) {
  const devicesLoading =
    principalsLoading || profilesLoading || sessionsLoading;

  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text variant="bodyBold" label="Devices & identities" />
      <CaptionLine label="Each row is one install (principal). Profiles are per device." />
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
            <DeviceRow
              key={p.entityId}
              principal={p}
              profile={profilesByPrincipal.get(p.entityId)}
              sessionInfo={sessionsByPrincipal.get(p.entityId)}
              profilesLoading={profilesLoading}
            />
          ))}
        </Box>
      )}
    </Card>
  );
}
