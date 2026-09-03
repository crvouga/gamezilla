import { describe, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  setNote,
  setNoteV2,
  syncVirtualHost,
} from '../apps/acme';
import { expectAllNotesAgree, expectLiveNoteAt } from '../apps/acme/reads';

describe('query v1 v2 mixed clients converge', () => {
  test.each([760, 761, 762])(
    'notesAll + notesAllV2 clients match (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, {
        id: 'alice',
        actorId: 'alice',
        sessionQuery: { name: 'notesAll', params: {} },
      });
      await run.apply(addClient, {
        id: 'bob',
        actorId: 'bob',
        sessionQuery: { name: 'notesAllV2', params: {} },
      });

      await run.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'from-v1-client',
      });
      await run.apply(mutate, 'bob', setNoteV2, {
        id: 'n2',
        body: 'from-v2-client',
      });
      await expectConverged(run);

      await expectLiveNoteAt(run, 'alice', 'n1', { body: 'from-v1-client' });
      await expectLiveNoteAt(run, 'alice', 'n2', { body: 'from-v2-client' });
      await expectLiveNoteAt(run, 'bob', 'n1', { body: 'from-v1-client' });
      await expectLiveNoteAt(run, 'bob', 'n2', { body: 'from-v2-client' });
      await expectAllNotesAgree(run, ['alice', 'bob']);
    }
  );
});
