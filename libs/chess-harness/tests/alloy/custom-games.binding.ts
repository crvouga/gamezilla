import { readStoredCustomGameWorld } from '@libs/chess-custom-game-harness/custom-game-stored';
import { bindStructure } from '@pkgs/alloy-shared/registry';
import type { Snapshot } from '@pkgs/alloy-shared/world';
import { openHarness } from '../open-chess-harness';
import {
  customFact,
  customHumans,
  customPerson,
  customStart,
} from '../steps/custom-game-world';
import { projectCustomGames } from './custom-games-projection';

bindStructure({
  spec: 'custom-games',
  snapshots: {
    'room authority and space membership': async () => {
      await using s = await openHarness('alloy-custom-games');
      const w = { s, memo: new Map<string, unknown>() };
      const snapshots: Snapshot[] = [];
      const capture = async (label: string) => {
        const spaceId =
          String(w.memo.get('custom-link')).split('/space/')[1] ?? '';
        snapshots.push(
          projectCustomGames(
            await s.read(readStoredCustomGameWorld, spaceId),
            label
          )
        );
      };
      await customHumans(w, { host: 'alice', white: 'alice', black: 'bob' });
      await capture('two people choosing their game');
      await customStart(w);
      await capture('two ready people playing');
      await customFact(w, 'bob', { operation: 'resign' });
      await capture('a completed game retains its participants');
      await customFact(w, 'alice', { operation: 'create' });
      await customFact(w, 'alice', {
        operation: 'invite',
        side: 'black',
        person: customPerson(w, 'bob'),
      });
      await capture('a waiting invitation belongs to one side');
      await customFact(w, 'alice', { operation: 'cancel' });
      await capture('cancellation releases invitations');
      await customFact(w, 'alice', { operation: 'create' });
      await customFact(w, 'alice', { operation: 'bot', side: 'white' });
      await customFact(w, 'alice', { operation: 'bot', side: 'black' });
      await customStart(w);
      await capture('the creator watches two bots');
      await customFact(w, 'alice', { operation: 'cancel' });
      return snapshots;
    },
  },
});
