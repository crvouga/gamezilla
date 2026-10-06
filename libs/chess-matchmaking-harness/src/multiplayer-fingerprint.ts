import type { storedMultiplayerSnapshot } from './multiplayer-reads';

/** Provider account ids are opaque; compare the same named people across runs. */
export function multiplayerFingerprint(
  snapshot: Awaited<ReturnType<typeof storedMultiplayerSnapshot>>,
  owners: ReadonlyMap<string, string>
): string {
  const person = (id: string) => owners.get(id) ?? id;
  return JSON.stringify({
    games: snapshot.games.map((game) => ({
      ...game,
      white_id: person(game.white_id),
      black_id: person(game.black_id),
      turn: person(game.turn),
      ...(game.draw_offer_by
        ? { draw_offer_by: person(game.draw_offer_by) }
        : {}),
      ...(game.rematch_offer_by
        ? { rematch_offer_by: person(game.rematch_offer_by) }
        : {}),
    })),
    current: snapshot.current
      .map((row) => ({ ...row, owner_id: person(row.owner_id) }))
      .sort((a, b) =>
        a.owner_id < b.owner_id ? -1 : a.owner_id > b.owner_id ? 1 : 0
      ),
  });
}
