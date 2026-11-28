import { expect, test } from 'bun:test';
import type { GameClientRegistration } from '@libs/game-menu-client-ts/game-client';
import { GameHomeScreenView } from '@libs/game-menu-client-ts/game-home-screen-view';
import type { GameMenuPlace } from '@libs/game-menu-client-ts/game-menu-places';
import { openMoreChoices } from '@libs/game-session-harness-ts/game-more-choices';
import { GAME_CLIENT_DEFINITIONS } from '@libs/games-client-ts/game-plugins.client';
import { GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';
import { setupI18n } from '@lingui/core';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { I18nProvider } from '@pkgs/lingui-solid-client-ts/runtime';
import {
  AudioPlaybackProvider,
  SoundsPreferenceProvider,
} from '@pkgs/sounds-client-ts/solid';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds-shared-ts/in-memory-audio-playback-port';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { createSolidDomDriver } from '@pkgs/ui-testing-solid-dom-client-ts/solid-dom-driver';
import { createSignal } from 'solid-js';
import { practiceControls, previewWallWithKeyboard } from './lesson-controls';

function mountMenu(game: GameClientRegistration) {
  const { clock, timers } = createHarnessClock();
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  return createSolidDomDriver({
    clock,
    pump: async () => {
      clock.advance(10);
      await Promise.resolve();
    },
    harness: {
      createRoot: () => () => {
        const [place, setPlace] = createSignal<GameMenuPlace>({
          screen: 'home',
        });
        return (
          <I18nProvider i18n={i18n}>
            <ClockProvider clock={clock} timers={timers}>
              <ThemeProvider
                fixedLayout={{
                  width: game.family === 'light-cycles' ? 390 : 1440,
                  height: 900,
                }}
              >
                <SurfaceStackProvider>
                  <AudioPlaybackProvider
                    value={createInMemoryAudioPlaybackPort()}
                  >
                    <SoundsPreferenceProvider>
                      <GameHomeScreenView
                        title={game.title}
                        tile={game.motif}
                        subtitle={game.caption}
                        choices={[]}
                        onChoose={() => {
                          throw new Error(
                            'Practice opened a shared game screen'
                          );
                        }}
                        lesson={game.lesson}
                        place={place()}
                        onOpen={setPlace}
                      />
                    </SoundsPreferenceProvider>
                  </AudioPlaybackProvider>
                </SurfaceStackProvider>
              </ThemeProvider>
            </ClockProvider>
          </I18nProvider>
        );
      },
    },
  });
}

// regression: quoridor-how-to-play-only-text
test.each(GAME_CLIENT_DEFINITIONS.map((game) => [game.id, game] as const))(
  '%s offers a playable lesson, can replay it and returns to its own menu',
  async (id, game) => {
    const definition = GAME_DEFINITIONS.find((entry) => entry.id === id);
    await definition?.turnGame?.rules.prepare?.();
    const ui = mountMenu(game);
    try {
      await ui.launch();
      await openMoreChoices(ui);
      await ui.get('game-choice-how-to-play').tap();
      const actions = practiceControls[id];
      expect(actions?.length).toBe(game.lesson?.length);
      const first = await ui.get('practice-prompt').text();
      expect(first).toBeTruthy();
      for (const action of actions!) {
        expect(await ui.get('practice-next').isVisible()).toBe(false);
        await action(ui);
        await ui.get('practice-next').tap();
      }
      expect(await ui.get('practice-prompt').text()).toBe(first);
      expect(await ui.get('practice-next').isVisible()).toBe(false);
      await ui.get('practice-leave').key('enter');
      await openMoreChoices(ui);
      expect(await ui.get('game-choice-how-to-play').isVisible()).toBe(true);
    } finally {
      await ui.close();
    }
  }
);

// regression: quoridor-lesson-wall-controls
test('retrying a Quoridor wall discards the preview and lets the player place it', async () => {
  const game = GAME_CLIENT_DEFINITIONS.find(
    (client) => client.id === 'quoridor'
  )!;
  const ui = mountMenu(game);
  try {
    await ui.launch();
    await openMoreChoices(ui);
    await ui.get('game-choice-how-to-play').tap();
    await ui.get('practice-board-action-e2').key('enter');
    await ui.get('practice-next').tap();
    await previewWallWithKeyboard(ui);
    expect(await ui.get('practice-board-wall-commit').isVisible()).toBe(true);
    await ui.get('practice-retry').tap();
    expect(await ui.get('practice-board-wall-commit').isVisible()).toBe(false);
    expect(await ui.get('practice-prompt').text()).toContain(
      'gap above the right half of d6'
    );
    expect(await ui.get('practice-next').isVisible()).toBe(false);
    await previewWallWithKeyboard(ui);
    await ui.get('practice-board-wall-commit').key('enter');
    for (const cell of ['d6', 'e6']) {
      expect(
        await ui.get(`practice-board-action-${cell}`).attribute('data-edge-top')
      ).toBe('true');
    }
    await ui.get('practice-next').key('enter');
    expect(await ui.get('practice-prompt').text()).toContain('Move to e9');
  } finally {
    await ui.close();
  }
});
