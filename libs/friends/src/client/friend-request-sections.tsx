import { Box, Text } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import {
  FriendRequestIncomingRow,
  FriendRequestOutgoingRow,
} from './friend-request-row-actions';
import type { EnrichedFriendRequest } from '../shared/friends-types';

function RequestSection({
  title,
  emptyLabel,
  loading,
  requests,
  onChanged,
  onPressUser,
  kind,
}: {
  title: string;
  emptyLabel: string;
  loading: boolean;
  requests: readonly EnrichedFriendRequest[];
  onChanged: () => void;
  onPressUser: (request: EnrichedFriendRequest) => void;
  kind: 'incoming' | 'outgoing';
}): ReactNode {
  const Row =
    kind === 'incoming' ? FriendRequestIncomingRow : FriendRequestOutgoingRow;

  return (
    <Box sx={{ gap: 1 }}>
      <Text variant="heading" label={title} />
      {requests.length === 0 && !loading ? (
        <Text variant="body" label={emptyLabel} />
      ) : (
        requests.map((request) => (
          <Row
            key={request.id}
            request={request}
            onChanged={onChanged}
            onPress={() => onPressUser(request)}
          />
        ))
      )}
    </Box>
  );
}

export function FriendRequestSections({
  loading,
  incoming,
  outgoing,
  onChanged,
  onPressUser,
}: {
  loading: boolean;
  incoming: readonly EnrichedFriendRequest[];
  outgoing: readonly EnrichedFriendRequest[];
  onChanged: () => void;
  onPressUser: (request: EnrichedFriendRequest) => void;
}): ReactNode {
  const { t } = useLingui();

  return (
    <>
      <RequestSection
        title={t`Requests`}
        emptyLabel={t`No incoming requests`}
        loading={loading}
        requests={incoming}
        onChanged={onChanged}
        onPressUser={onPressUser}
        kind="incoming"
      />
      <RequestSection
        title={t`Sent`}
        emptyLabel={t`No sent requests`}
        loading={loading}
        requests={outgoing}
        onChanged={onChanged}
        onPressUser={onPressUser}
        kind="outgoing"
      />
    </>
  );
}
