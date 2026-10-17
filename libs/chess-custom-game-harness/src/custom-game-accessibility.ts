import {
  readCustomGameProbe,
  waitCustomGameSettled,
} from '@libs/game-session-harness/custom-game-ui';
import { actorPage, tabTo } from '@libs/harness/actor-page';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { auditTree, formatFailure } from '@pkgs/a11y-shared/audit';
import { isHiddenFromAt } from '@pkgs/a11y-shared/visibility';

export const chooseCustomGameWithKeyboard = scenarioAction({
  name: 'chooseCustomGameWithKeyboard',
  act: async (s, actor: string, operation: 'bot' | 'start') => {
    const probe = await readCustomGameProbe(s, actor);
    if (probe === null) throw new Error('keyboard has no game');
    const ui = await actorUi(s, actor);
    if (operation === 'bot') {
      await tabTo(s, actor, 'custom-game-black-choices');
      await ui.key('enter');
      await s.session.waitForIdle();
    }
    await tabTo(
      s,
      actor,
      operation === 'bot' ? 'custom-game-black-bot' : 'custom-game-start'
    );
    await ui.key('enter');
    await waitCustomGameSettled(s, actor, probe.settled);
  },
});

export const listenToCustomGame = scenarioAction({
  name: 'listenToCustomGame',
  act: async (s, actor: string) => {
    await actorPage(s, actor);
  },
});

/** What the actual live status exposes to assistive technology, plus ACT failures. */
export async function readCustomGameHeard(s: ProductHarness, actor: string) {
  const page = await actorPage(s, actor);
  const status = page.querySelector('[data-testid="custom-game-status"]');
  if (
    status === null ||
    isHiddenFromAt(status) ||
    status.getAttribute('role') !== 'status' ||
    status.getAttribute('aria-live') !== 'polite'
  )
    throw new Error('the game status is not announced');
  return {
    description: status.textContent ?? '',
    problems: auditTree(page).map(formatFailure),
  };
}
