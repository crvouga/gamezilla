import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/** Choose on the already open screen, without any extra navigation. */
export const turnSoundsOnInPlace = scenarioAction({
  name: 'turnSoundsOnInPlace',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.soundEffectsSwitch).tap({ timeoutMs: 15_000 });
    await s.session.waitForIdle();
  },
});

/** The sound controls remain in front of the person rather than a boot wait. */
export async function localSoundChoiceUsable(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  return (
    (await ui.get(Handles.soundEffectsSwitch).isVisible()) &&
    !(await ui.get(Handles.bootLoading).isVisible())
  );
}
