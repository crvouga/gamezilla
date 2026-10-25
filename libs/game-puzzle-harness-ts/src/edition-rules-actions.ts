import { readContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { selectedPlay } from './attempt-actions';
import { closeBuilders } from './builder-session';
import { contentClient } from './content-actions';
import { waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import { mountContentExample } from './mount-content-example';

const RULES_CHANGED = 'PUZZLE_RULES_CHANGED';

/** An app update with incompatible rules: open screens close, as on a reload. */
export const changeGameRules = defineAction({
  name: 'changeGameRules',
  act: (s: ContentHarness) => {
    s.rules.version += 1;
    closeBuilders(s);
  },
});

/** Opens the device's saved attempt through the shared screens and reads what it says. */
export async function resumeAttemptOnScreen(
  s: ContentHarness,
  clientId: string
): Promise<void> {
  const selection = selectedPlay(s, clientId);
  s.notices.delete(clientId);
  s.lastResult.delete(clientId);
  const view = await mountContentExample(s, clientId);
  try {
    const entry = `content-attempt-${selection.attemptId}`;
    await waitForContent(s, () =>
      Promise.resolve(view.queryByTestId(entry) !== null)
    );
    fireEvent.click(view.getByTestId(entry));
    await waitForContent(s, () =>
      Promise.resolve(view.queryByTestId('content-attempt') !== null)
    );
    if (view.queryByTestId('content-attempt-rules-changed') !== null)
      s.notices.set(clientId, RULES_CHANGED);
  } finally {
    view.unmount();
  }
}

export const resumeAttemptThroughScreen = defineAction({
  name: 'resumeAttemptThroughScreen',
  act: resumeAttemptOnScreen,
});

/** Whether the device was refused, or shows its open attempt as needing other rules. */
export async function toldRulesChanged(
  s: ContentHarness,
  clientId: string
): Promise<boolean> {
  const result = s.lastResult.get(clientId);
  if (result?.ok === false) return result.failures[0]?.code === RULES_CHANGED;
  if (s.notices.get(clientId) === RULES_CHANGED) return true;
  if (!s.playSelections.has(clientId)) return false;
  await resumeAttemptOnScreen(s, clientId);
  return s.notices.get(clientId) === RULES_CHANGED;
}

/** The game rules version each of the device's editions of `title` keeps. */
export async function editionRulesVersions(
  s: ContentHarness,
  clientId: string,
  title: string
): Promise<readonly number[]> {
  const library = await readContentLibrary(contentClient(s, clientId).db);
  return library.revisions
    .filter((edition) => edition.title === title)
    .map((edition) => edition.rules_version);
}

export const EDITION_RULES_ACTIONS = [
  changeGameRules,
  resumeAttemptThroughScreen,
] as const;
