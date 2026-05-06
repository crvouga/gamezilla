import { Box, ScrollView, Text } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';

import { SpaceMemberTile } from './space-member-tile';
import type { SpaceMemberRow } from './types';
import {
  defaultMemberFlags,
  type MemberPresenceFlags,
} from './use-member-presence-flags';

export type SpaceSessionMemberRailProps = {
  host: SpaceMemberRow | null;
  guests: SpaceMemberRow[];
  flags: Map<string, MemberPresenceFlags>;
};

function RailMemberTile({
  member,
  flags,
}: {
  member: SpaceMemberRow;
  flags: Map<string, MemberPresenceFlags>;
}) {
  const f = flags.get(member.memberId) ?? defaultMemberFlags();
  return (
    <SpaceMemberTile
      member={member}
      online={f.online}
      sessionCount={f.sessionCount}
      thisTab={f.thisTab}
      isYou={f.isYou}
      variant="rail"
    />
  );
}

function RailHostBlock({
  host,
  flags,
}: {
  host: SpaceMemberRow | null;
  flags: Map<string, MemberPresenceFlags>;
}) {
  return (
    <Box sx={{ gap: 1 }}>
      <Text
        variant="label"
        sx={{ color: 'textSecondary', px: 2 }}
        label={<Trans>Host</Trans>}
      />
      <Box sx={{ gap: 0 }}>
        {host ? (
          <RailMemberTile member={host} flags={flags} />
        ) : (
          <Text
            variant="caption"
            sx={{ color: 'textSecondary', px: 2 }}
            label={<Trans>No host listed</Trans>}
          />
        )}
      </Box>
    </Box>
  );
}

function RailGuestsBlock({
  guests,
  flags,
}: {
  guests: SpaceMemberRow[];
  flags: Map<string, MemberPresenceFlags>;
}) {
  return (
    <Box sx={{ gap: 1 }}>
      <Text
        variant="label"
        sx={{ color: 'textSecondary', px: 2 }}
        label={<Trans>Guests</Trans>}
      />
      <Box sx={{ gap: 0 }}>
        {guests.length === 0 ? (
          <Text
            variant="caption"
            sx={{ color: 'textSecondary', px: 2 }}
            label={<Trans>No guests yet</Trans>}
          />
        ) : (
          guests.map((m) => <RailMemberTile key={m.memberId} member={m} flags={flags} />)
        )}
      </Box>
    </Box>
  );
}

/** Host + guest blocks without an outer `ScrollView` (e.g. inside another scroller or modal). */
export function SpaceSessionMemberRailInner({
  host,
  guests,
  flags,
}: SpaceSessionMemberRailProps) {
  return (
    <Box sx={{ gap: 4, paddingBottom: 2 }}>
      <RailHostBlock host={host} flags={flags} />
      <RailGuestsBlock guests={guests} flags={flags} />
    </Box>
  );
}

export function SpaceSessionMemberRail({
  host,
  guests,
  flags,
}: SpaceSessionMemberRailProps) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 8, gap: 16 }}
    >
      <SpaceSessionMemberRailInner host={host} guests={guests} flags={flags} />
    </ScrollView>
  );
}
