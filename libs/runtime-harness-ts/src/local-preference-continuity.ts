import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/** Choose on the already open screen, without any extra navigation. */
export const chooseLightInPlace = scenarioAction({
  name: 'chooseLightInPlace',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.themeOption('light')).tap({ timeoutMs: 15_000 });
    await s.session.waitForIdle();
  },
});

/** The theme controls remain in front of the person rather than a boot wait. */
export async function localThemeChoiceUsable(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  return (
    (await ui.get(Handles.themeOption('light')).isVisible()) &&
    !(await ui.get(Handles.bootLoading).isVisible())
  );
}
