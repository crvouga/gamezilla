import {
  Box,
  Button,
  ScreenBase,
  Text,
  useMutationButton,
} from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

import type { InteractionFilter } from '../shared/interaction';
import { InboxFilterBar } from './inbox-filter-bar';
import { InboxList } from './inbox-list';
import { useInboxShell } from './inbox-provider-registry';
import { useInbox } from './use-inbox';
import { useInboxActions } from './use-inbox-actions';
import { useInboxBackfill } from './use-inbox-backfill';

export type InboxScreenProps = {
  readonly accountMenu?: ReactNode;
  readonly leading?: ReactNode;
  readonly initialFilter?: InteractionFilter;
};

function InboxSignedInGate({ children }: { readonly children: ReactNode }): ReactNode {
  const { isSignedIn, onSignIn } = useInboxShell();
  if (isSignedIn) return children;
  return (
    <Box sx={{ gap: 2, py: 4, alignItems: 'center' }}>
      <Text variant="body" label={<Trans>Sign in to view your inbox</Trans>} />
      {onSignIn !== undefined ? (
        <Button variant="solid" onPress={onSignIn} title={<Trans>Sign in</Trans>} />
      ) : null}
    </Box>
  );
}

function InboxScreenBody({
  initialFilter,
}: {
  readonly initialFilter?: InteractionFilter;
}): ReactNode {
  const { t } = useLingui();
  useInboxBackfill();
  const inboxOptions =
    initialFilter !== undefined ? { filter: initialFilter } : {};
  const { interactions, sections, isLoading, filter, setFilter } =
    useInbox(inboxOptions);
  const inboxActions = useInboxActions();
  const markAllRead = useMutationButton({
    operation: useCallback(async () => {
      await inboxActions.markAllRead();
    }, [inboxActions]),
    labels: {
      idle: t`Mark all read`,
      loading: t`Marking…`,
      success: t`Marked read`,
      error: t`Failed`,
    },
    successHoldMs: 0,
  });

  return (
    <Box sx={{ gap: 3 }}>
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <InboxFilterBar filter={filter} onFilterChange={setFilter} />
        {interactions.some((item) => item.isUnread) ? (
          <Button variant="ghost" {...markAllRead.buttonProps} />
        ) : null}
      </Box>
      <InboxList sections={sections} isLoading={isLoading} actions={inboxActions} />
    </Box>
  );
}

export function InboxScreen({
  accountMenu,
  leading,
  initialFilter,
}: InboxScreenProps): ReactNode {
  const { t } = useLingui();

  return (
    <ScreenBase
      breadcrumbs={[{ name: t`Inbox` }]}
      accountMenu={accountMenu}
      leading={leading}
      content={({ sx }) => (
        <Box style={sx}>
          <InboxSignedInGate>
            <InboxScreenBody
              {...(initialFilter !== undefined ? { initialFilter } : {})}
            />
          </InboxSignedInGate>
        </Box>
      )}
    />
  );
}
