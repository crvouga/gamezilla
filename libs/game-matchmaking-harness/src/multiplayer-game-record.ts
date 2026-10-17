import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import type { RecordingClipboard } from '@pkgs/device-shared/clipboard';
import { hostLimit } from '@pkgs/gherkin-shared/registry';

/** The copy controls a matched game's screen offers once it is over with a result. */
const COPY_CONTROLS = {
  'game record': 'multiplayer-copy-game-record',
  'final position': 'multiplayer-copy-final-position',
} as const;

export type MultiplayerCopy = keyof typeof COPY_CONTROLS;

async function clipboardOf(
  s: ProductHarness,
  actor: string
): Promise<RecordingClipboard> {
  const env = await s.harness.client(actor);
  const clipboard = env.clipboard as Partial<RecordingClipboard>;
  if (typeof clipboard.last !== 'function')
    throw hostLimit('this host does not show what a person copied');
  return clipboard as RecordingClipboard;
}

/** What a person's matched-game screen offers them to copy. */
export async function gameRecordOffered(
  s: ProductHarness,
  actor: string
): Promise<{ readonly gameRecord: boolean; readonly finalPosition: boolean }> {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  return {
    gameRecord: await ui.get(COPY_CONTROLS['game record']).isVisible(),
    finalPosition: await ui.get(COPY_CONTROLS['final position']).isVisible(),
  };
}

/**
 * The person copies the game record or the final position the matched-game
 * screen in front of them offers, and the copy lands on their device.
 */
export const copyShownMultiplayerText = scenarioAction({
  name: 'copyShownMultiplayerText',
  act: async (s, actor: string, what: MultiplayerCopy) => {
    const clipboard = await clipboardOf(s, actor);
    const before = clipboard.writes.length;
    await bringToFront(s, actor);
    await (await actorUi(s, actor)).get(COPY_CONTROLS[what]).tap();
    await pollUntil(
      s,
      async () => (clipboard.writes.length > before ? true : null),
      { maxMs: 5000, stepMs: 1, description: `copying the ${what}` }
    );
  },
});

/** What the person last copied on this device; null before anything was. */
export async function copiedMultiplayerText(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  return (await clipboardOf(s, actor)).last();
}
