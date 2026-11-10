/** A person and a Synthetic User after a finished game: rematch offers and answers. */
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { bringToFront } from '@libs/harness-ts/observations';
import { carryOnSyntheticUsers, setPlaySetup } from './live-synthetic-users';

/** Long enough for any rule about answering a rematch to have played out. */
const ANSWER_WINDOW_MS = 30_000;

type Offer = {
  offeredAt: number;
  answeredAt: number | null;
  accepted: boolean;
};
const offers = new WeakMap<ProductHarness, Offer>();

/** What the person's device shows of their rematch offer: still standing, accepted (a new game) or declined. */
async function offerShown(s: ProductHarness, actor: string, gameId: string) {
  await bringToFront(s, actor);
  const game = (await multiplayerView(s, actor)).game;
  if (game !== null && game.id !== gameId && game.outcome === 'ongoing')
    return 'accepted';
  return game?.id === gameId && (game.rematch_offer_by ?? '') === ''
    ? 'declined'
    : 'waiting';
}

/**
 * The person offers the Synthetic User a rematch through the game's
 * controls; the Synthetic Users carry on meanwhile until it is answered or
 * long enough has passed for any rule to have played out.
 */
export const offerRematchTo = scenarioAction({
  name: 'offerRematchTo',
  act: async (s, actor: string) => {
    await bringToFront(s, actor);
    const ui = await actorUi(s, actor);
    const gameId = (await multiplayerView(s, actor)).game?.id ?? '';
    await ui.get('multiplayer-offer-rematch').tap();
    const own = await signedInAccountOf(s, actor);
    await pollUntil(
      s,
      async () =>
        (await multiplayerView(s, actor)).game?.rematch_offer_by === own
          ? true
          : null,
      { maxMs: 10_000, description: 'the rematch offer is made' }
    );
    const offer: Offer = {
      offeredAt: s.harness.clock.now(),
      answeredAt: null,
      accepted: false,
    };
    offers.set(s, offer);
    await carryOnSyntheticUsers(s, {
      maxMs: ANSWER_WINDOW_MS,
      observe: async () => {
        const shown = await offerShown(s, actor, gameId);
        if (offer.answeredAt !== null || shown === 'waiting') return;
        offer.answeredAt = s.harness.clock.now();
        offer.accepted = shown === 'accepted';
      },
      settled: async () => offer.answeredAt !== null,
    });
  },
});

/** How the person's rematch offer was answered, and how long after it was made; `null` while unanswered. */
export function rematchAnswerSeen(s: ProductHarness) {
  const offer = offers.get(s);
  if (offer === undefined || offer.answeredAt === null) return null;
  return {
    accepted: offer.accepted,
    afterMs: offer.answeredAt - offer.offeredAt,
  };
}

/** Whether the person is offered a rematch, as their game's controls show. */
export async function rematchOffered(s: ProductHarness, actor: string) {
  await bringToFront(s, actor);
  return (await actorUi(s, actor))
    .get('multiplayer-accept-rematch')
    .isVisible();
}

/**
 * The Synthetic User has played `games` games in a row against the person,
 * the latest just finished; it would gladly play them again.
 */
export const givenGamesInARow = scenarioAction({
  name: 'givenGamesInARow',
  act: async (s, name: string, games: number, person: string) => {
    const opponent = await signedInAccountOf(s, person);
    if (opponent === null) throw new Error(`${person} has no account`);
    setPlaySetup(s, name, {
      persona: { rematchWeight: 1 },
      memory: { streak: { opponent, games } },
    });
  },
});
