import { useIo } from '@pkgs/io';
import { useQuery } from '@pkgs/sync-engine/client';
import { useEffect, useMemo, useState } from 'react';
import type { Interaction, InteractionFilter } from '../shared/interaction';
import { clientRowToInteraction } from '../shared/row-mapper';
import { useInboxShell } from './inbox-provider-registry';
import { inboxListSql } from './inbox-queries';
import { buildInteractionSections } from './inbox-sections';

export function useInbox(options?: { readonly filter?: InteractionFilter }): {
  readonly interactions: readonly Interaction[];
  readonly sections: ReturnType<typeof buildInteractionSections>;
  readonly isLoading: boolean;
  readonly filter: InteractionFilter;
  readonly setFilter: (filter: InteractionFilter) => void;
} {
  const { userId } = useInboxShell();
  const io = useIo();
  const [filter, setFilter] = useState<InteractionFilter>(
    options?.filter ?? 'all'
  );

  useEffect(() => {
    if (options?.filter !== undefined) {
      setFilter(options.filter);
    }
  }, [options?.filter]);
  const query = useMemo(() => inboxListSql(userId, filter), [userId, filter]);
  const { rows, isLoading } = useQuery(query);
  const interactions = useMemo(
    () => rows.map((row) => clientRowToInteraction({ ...row })),
    [rows]
  );
  const sections = useMemo(
    () => buildInteractionSections(interactions, io.clock.now),
    [interactions, io.clock.now]
  );
  return { interactions, sections, isLoading, filter, setFilter };
}
