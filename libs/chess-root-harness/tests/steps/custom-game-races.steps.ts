import { attemptCustomGameChoice } from '@libs/game-session-harness/custom-game-ui';
import type { CustomGame } from '@libs/game-session-shared/custom-game-state';
import { When } from '@libs/harness/define';

When(
  '{actor} opens Black using earlier Custom Game choices',
  async (w, actor: string) => {
    const earlier = w.memo.get('custom-earlier') as CustomGame;
    await w.s.apply(attemptCustomGameChoice, actor, {
      operation: 'open',
      side: 'black',
      gameId: earlier.id,
      revision: earlier.revision,
    });
  }
);
