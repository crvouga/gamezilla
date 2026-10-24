import { expect, test } from 'bun:test';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { clientGatingLayer } from '@libs/permissions-harness-ts/client';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { createSignal } from 'solid-js';
import { billingSubscriptionsFixture } from './billing-fixture';

test('puzzle scope facts reach client decisions and follow a changed target', async () => {
  // regression: puzzle-ownership-missing-from-client-decisions
  const layer = clientGatingLayer({
    tables: [billingSubscriptionsFixture],
    probe: () => {
      const [owner, setOwner] = createSignal(
        '00000000-0000-4000-8000-000000000e57'
      );
      const edit = useDecision(PERMISSION.puzzlesEditContent, () => ({
        puzzleOwnerId: owner(),
      }));
      const play = useDecision(PERMISSION.puzzlesEditAttempt, () => ({
        puzzlePlayerId: owner(),
      }));
      return () => {
        const ownEdit = edit().allowed;
        const ownPlay = play().allowed;
        setOwner('00000000-0000-4000-8000-000000000b0b');
        const foreignEdit = edit().allowed;
        const foreignPlay = play().allowed;
        setOwner('00000000-0000-4000-8000-000000000e57');
        return {
          ownEdit,
          ownPlay,
          foreignEdit,
          foreignPlay,
          restoredEdit: edit().allowed,
        };
      };
    },
  });
  expect(
    await layer.decide(
      { 'who is asking': 'guest' },
      {
        decisionId: 'puzzle-scope',
        caseId: 'own-and-foreign',
        world: undefined,
      }
    )
  ).toEqual({
    ownEdit: true,
    ownPlay: true,
    foreignEdit: false,
    foreignPlay: false,
    restoredEdit: true,
  });
});
