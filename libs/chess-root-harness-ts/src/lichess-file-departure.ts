import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { prepareSavingLichessFile } from './lichess-file-setup';
import { followPuzzleImport } from './puzzle-import-ui';
import { joinPuzzleTeam } from './puzzle-import-world';

export const askToLeaveAddingPuzzles = scenarioAction({
  name: 'askToLeaveAddingPuzzles',
  act: async (s, actor: string = 'alice') => {
    const ui = await actorUi(s, actor);
    await ui.get(Handles.navBack).tap();
    await s.session.waitForIdle();
  },
});

export const cancelLeavingAddingPuzzles = scenarioAction({
  name: 'cancelLeavingAddingPuzzles',
  act: async (s, actor: string = 'alice') => {
    const ui = await actorUi(s, actor);
    await ui.get('pending-navigation-stay').tap();
  },
});

export const confirmLeavingAddingPuzzles = scenarioAction({
  name: 'confirmLeavingAddingPuzzles',
  act: async (s, actor: string = 'alice') => {
    const ui = await actorUi(s, actor);
    await ui.get('pending-navigation-leave').tap();
    await s.session.waitForIdle();
  },
});

export const prepareChoosingLichessDeparture = scenarioAction({
  name: 'prepareChoosingLichessDeparture',
  act: async (s, actor: string = 'alice', spaceLink?: string) => {
    await Promise.resolve(prepareSavingLichessFile.act(s, actor, spaceLink));
    await Promise.resolve(askToLeaveAddingPuzzles.act(s, actor));
  },
});

export const prepareLichessDeparture = scenarioAction({
  name: 'prepareLichessDeparture',
  act: async (s) => {
    await Promise.resolve(signInWithGoogle.act(s, 'alice'));
    await Promise.resolve(joinPuzzleTeam.act(s, 'alice'));
    await Promise.resolve(followPuzzleImport.act(s, 'alice'));
    await Promise.resolve(prepareSavingLichessFile.act(s, 'alice'));
  },
});

export async function readLichessDeparture(s: ProductHarness, actor = 'alice') {
  const ui = await actorUi(s, actor);
  return {
    followingAddingPuzzles: await ui.get('puzzle-load-content').isVisible(),
    savingLichessFile: await ui.get('puzzle-source-saving').isVisible(),
    leavingAddingPuzzles: await ui
      .get('pending-navigation-warning')
      .isVisible(),
    // Connectivity is an injected world fact, including when the person is elsewhere.
    online: !s.session.network
      .partitions()
      .some((pair) => pair[0] === actor || pair[1] === actor),
  };
}
