import { GAME_HOME_SCREEN } from '@libs/spaces-shared-ts/games';

/** Places actually shown on this device. A rematch or a reopened board is the same screen. */
export class GameScreenHistory {
  private readonly visits = new Map<
    string,
    { game: string; screens: string[] }
  >();

  visit(space: string, game: string, screen: string): void {
    let visit = this.visits.get(space);
    if (visit?.game !== game) {
      visit = { game, screens: [] };
      this.visits.set(space, visit);
    }
    const earlier = visit.screens.indexOf(screen);
    if (visit.screens.at(-1) === screen) return;
    if (earlier >= 0) visit.screens.splice(earlier, 1);
    visit.screens.push(screen);
  }

  back(space: string, game: string, screen: string): string {
    const visit = this.visits.get(space);
    if (visit?.game !== game) return GAME_HOME_SCREEN;
    if (visit.screens.at(-1) === screen) visit.screens.pop();
    return visit.screens.at(-1) ?? GAME_HOME_SCREEN;
  }

  forget(space: string): void {
    this.visits.delete(space);
  }
}
