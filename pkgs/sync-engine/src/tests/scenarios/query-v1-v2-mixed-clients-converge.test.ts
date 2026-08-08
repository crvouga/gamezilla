import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  setNote,
  setNoteV2,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('query v1 v2 mixed clients converge', () => {
  test.each([760, 761, 762])(
    'notesWorld + notesWorldV2 clients match (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: notesDomainPack,
        seed,
      });
      const a = await world.addClient({
        id: 'alice',
        sessionQuery: { name: 'notesWorld', params: {} },
      });
      const b = await world.addClient({
        id: 'bob',
        sessionQuery: { name: 'notesWorldV2', params: {} },
      });

      await a.mutate(setNote, { id: 'n1', body: 'from-v1-client' });
      await b.mutate(setNoteV2, { id: 'n2', body: 'from-v2-client' });
      await world.assertConverged();

      await expectLiveNote(a.db, 'n1', { body: 'from-v1-client' });
      await expectLiveNote(a.db, 'n2', { body: 'from-v2-client' });
      await expectLiveNote(b.db, 'n1', { body: 'from-v1-client' });
      await expectLiveNote(b.db, 'n2', { body: 'from-v2-client' });
      await expectNotesMatchServer(a.db, world.server.db);
      await expectNotesMatchServer(b.db, world.server.db);
    }
  );
});
