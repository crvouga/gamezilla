import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';
import { useEffect, useMemo, useState } from 'react';

import { clientRowToInteraction } from '../server/row-mapper';
import type { Interaction, InteractionFilter } from '../shared/interaction';
import { buildInteractionSections } from './inbox-sections';
import { inboxListSql } from './inbox-queries';
import { useInboxShell } from './inbox-provider-registry';

export function useInbox(options?: {
  readonly filter?: InteractionFilter;
}): {
  readonly interactions: readonly Interaction[];
  readonly sections: ReturnType<typeof buildInteractionSections>;
  readonly isLoading: boolean;
  readonly filter: InteractionFilter;
  readonly setFilter: (filter: InteractionFilter) => void;
} {
  const { userId } = useInboxShell();
  const [filter, setFilter] = useState<InteractionFilter>(
    options?.filter ?? 'all'
  );

  useEffect(() => {
    if (options?.filter !== undefined) {
      setFilter(options.filter);
    }
  }, [options?.filter]);
  const query = useMemo(() => inboxListSql(userId, filter), [userId, filter]);
  const { rows, isLoading } = useWatchQuery<Record<string, unknown>>(
    query.sql,
    query.params
  );
  const interactions = useMemo(
    () => rows.map((row) => clientRowToInteraction(row)),
    [rows]
  );
  const sections = useMemo(
    () => buildInteractionSections(interactions),
    [interactions]
  );
  return { interactions, sections, isLoading, filter, setFilter };
}
