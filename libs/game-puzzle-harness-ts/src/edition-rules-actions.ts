import { readContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { selectedPlay } from './attempt-actions';
import { closeBuilders } from './builder-session';
import { contentClient } from './content-actions';
import { openLibraryEntry } from './content-screen-places';
import { contentWait, waitForContent } from './content-sync';
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
    await openLibraryEntry(
      contentWait(s),
      view,
      `content-attempt-${selection.attemptId}`
    );
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

/**
 * Opens the device's saved attempt under rules this app lacks and presses
 * the notice's Update the app: the app is asked to load its newest version
 * (as its update banner does), with no unusable board or commands shown.
 */
export const updateAppFromAttempt = defineAction({
  name: 'updateAppFromAttempt',
  act: async (s: ContentHarness, clientId: string) => {
    const selection = selectedPlay(s, clientId);
    const view = await mountContentExample(s, clientId);
    const location = globalThis.location;
    const reload = location.reload;
    let reloads = 0;
    Object.defineProperty(location, 'reload', {
      configurable: true,
      value: () => {
        reloads += 1;
      },
    });
    try {
      await openLibraryEntry(
        contentWait(s),
        view,
        `content-attempt-${selection.attemptId}`
      );
      await waitForContent(s, () =>
        Promise.resolve(
          view.queryByTestId('content-attempt-rules-changed') !== null
        )
      );
      s.notices.set(
        'rules-changed-shows-board',
        String(
          view.queryByTestId('counting-step-one') !== null ||
            view.queryByTestId('content-undo') !== null
        )
      );
      fireEvent.click(view.getByRole('button', { name: 'Update the app' }));
      s.notices.set('rules-changed-update-requests', String(reloads));
    } finally {
      Object.defineProperty(location, 'reload', {
        configurable: true,
        value: reload,
      });
      view.unmount();
    }
  },
});
