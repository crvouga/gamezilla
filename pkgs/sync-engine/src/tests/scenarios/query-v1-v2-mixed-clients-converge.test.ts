import { describe, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  setNote,
  setNoteV2,
} from '../apps/acme';
import { expectAllNotesAgree, expectLiveNoteAt } from '../apps/acme/reads';

describe('query v1 v2 mixed clients converge', () => {
  test.each([760, 761, 762])(
    'notesAll + notesAllV2 clients match (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, {
        id: 'alice',
        actorId: 'alice',
        sessionQuery: { name: 'notesAll', params: {} },
      });
      await s.apply(addClient, {
        id: 'bob',
        actorId: 'bob',
        sessionQuery: { name: 'notesAllV2', params: {} },
      });

      await s.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'from-v1-client',
      });
      await s.apply(mutate, 'bob', setNoteV2, {
        id: 'n2',
        body: 'from-v2-client',
      });
      await expectConverged(s);

      await expectLiveNoteAt(s, 'alice', 'n1', { body: 'from-v1-client' });
      await expectLiveNoteAt(s, 'alice', 'n2', { body: 'from-v2-client' });
      await expectLiveNoteAt(s, 'bob', 'n1', { body: 'from-v1-client' });
      await expectLiveNoteAt(s, 'bob', 'n2', { body: 'from-v2-client' });
      await expectAllNotesAgree(s, ['alice', 'bob']);
    }
  );
});
