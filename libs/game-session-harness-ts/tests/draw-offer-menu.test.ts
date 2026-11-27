import { expect, test } from 'bun:test';
import { operateCustomGameControls } from '@libs/game-session-harness-ts/custom-game-controls';
import type { ProductHarness } from '@libs/harness-ts/harness';

function drawOfferMenu(answer: 'accepted' | 'refused') {
  let place = 'commands';
  let settled = 0;
  const taps: string[] = [];
  const visible = (id: string) =>
    id === 'custom-game-content' ||
    (place === 'commands' &&
      ['custom-game-offer', 'custom-game-resume'].includes(id));

  const render = () => {
    if (settled > 0 && answer === 'accepted') place = 'stage';
  };
  const ui = {
    get: (id: string) => ({
      layout: async () => null,
      isVisible: async () => visible(id),
      attribute: async (name: string) => (name === 'data-place' ? place : null),
      text: async () =>
        JSON.stringify({
          current: { status: 'active', ready: ['white', 'black'] },
          mySide: 'white',
          settled,
          error: answer === 'refused' && settled > 0 ? 'offer refused' : '',
        }),
      tap: async () => {
        taps.push(id);
        if (!visible(id))
          throw new Error(
            `${id} is covered by the custom-game-stage-menu ModalScrim`
          );
        if (id === 'custom-game-offer') settled++;
        if (id === 'custom-game-resume') place = 'stage';
      },
      expect: {
        hidden: async () => {
          render();
          expect(visible(id)).toBe(false);
        },
      },
    }),
    snapshotHtml: async () => null,
  };
  const s = {
    actors: new Map([['alice', { ui }]]),
    session: { waitForIdle: async () => render() },
  } as unknown as ProductHarness;
  return { s, taps, place: () => place };
}

// regression: draw-offer-menu-covers-back
test.each(['accepted', 'refused'] as const)(
  'Alice returns from the game menu after a repeat draw offer is %s',
  async (answer) => {
    const menu = drawOfferMenu(answer);
    await operateCustomGameControls(menu.s, 'alice', { operation: 'offer' });
    expect(menu.place()).toBe('stage');
    expect(menu.taps).toEqual(
      answer === 'accepted'
        ? ['custom-game-offer']
        : ['custom-game-offer', 'custom-game-resume']
    );
  }
);
