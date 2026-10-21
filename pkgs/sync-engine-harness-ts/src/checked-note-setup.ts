import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { setNote } from './mutations';
import { pumpInSync } from './pump';
import { requireClient } from './regression-support';
import type { SyncHarness } from './scenario-system';
import { rows } from './sync-observations';

/** Existing accepted writing before either person starts a checked write. */
export const prepareExistingCheckedNote = defineAction({
  name: 'prepareExistingCheckedNote',
  act: async (
    s: SyncHarness,
    note: { readonly body: string; readonly owner: string }
  ) => {
    if (note.owner === '') return;
    const result = await requireClient(s, note.owner).mutate(setNote, {
      id: 'Groceries',
      title: 'Groceries',
      body: note.body,
    });
    if (!result.ok) throw new Error('Earlier note writing was refused');
    await pumpInSync(s);
  },
});

/** Setup guard: the server has considered this checked write. */
export async function checkedNoteConsidered(
  s: SyncHarness,
  mutationId: string
): Promise<boolean> {
  const decisions = await rows(
    s,
    'considered-note',
    'server',
    sql`SELECT status FROM sync_engine_mutations_applied WHERE mutation_id = ${mutationId}`
  );
  return decisions.length === 1;
}
