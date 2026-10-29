import type { GamePuzzlesClient } from '@libs/game-puzzle-client-ts/puzzle-client';
import type { PuzzleContentClient } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { PuzzleSessionEffects } from '@libs/game-puzzle-client-ts/puzzle-frame';
import type {
  AnyGameRegistration,
  GameRegistration,
} from '@libs/game-session-shared-ts/game-definition';
import { assertGameDefinitions } from '@libs/game-session-shared-ts/game-definition';
import type { GameClientDefinition } from '@libs/spaces-shared-ts/game';
import type { GamePresentation } from '@pkgs/turn-game-shared-ts/game-presentation';
import { gameFamily } from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from 'solid-js';
import { assertContentFrame, assertFrame } from './game-frame-contract';
import { GameMenu } from './game-menu';
import { assertGameScreens } from './shared-game-screens';

/** How the shared screens show the game: its board, side names and endings. */
export type GameClientPresentation = Omit<GamePresentation<JSX.Element>, 'id'>;

/** A screen the game renders itself, shown to everyone in the space. */
export type GameOwnScreen = {
  /** Its key in the space; a choice's key also names its control (`game-choice-<screen>`). */
  readonly screen: string;
  readonly Screen: () => JSX.Element;
};

/** One of a game's own choices: how it is offered and the screen it opens. */
export type GameChoice = GameOwnScreen & {
  /** Rendered where the choice is offered (copy is rendered, never built ahead). */
  readonly title: () => JSX.Element;
  readonly caption: () => JSX.Element;
};

/**
 * The puzzles part, exactly when the shared registration offers puzzles:
 * required then, and refused for a game that offers none.
 */
export type GameClientPuzzles<C> = 'puzzles' extends keyof C
  ? undefined extends C['puzzles' & keyof C]
    ? { readonly puzzles?: GamePuzzlesClient }
    : { readonly puzzles: GamePuzzlesClient }
  : { readonly puzzles?: never };

/**
 * Everything a game supplies to the shared game experience. The platform
 * owns the menu, its order, the puzzle, custom-game, opponent and history
 * screens, the space-wide navigation and links; a game adds only what is
 * unique. Which shared screens appear follows the capabilities its shared
 * registration declares (`shared`), and a capability whose screens show
 * the game's own board asks for that part here (`puzzles`).
 */
export type GameClientContent<G extends AnyGameRegistration> =
  NonNullable<G['puzzleContent']> extends never
    ? { readonly puzzleContent?: never }
    : undefined extends G['puzzleContent']
      ? { readonly puzzleContent?: PuzzleContentClient }
      : { readonly puzzleContent: PuzzleContentClient };

export type GameClient<G extends AnyGameRegistration = AnyGameRegistration> =
  G extends AnyGameRegistration
    ? GameClientParts & { readonly shared: G } & (G extends GameRegistration<
          infer C
        >
          ? {
              readonly presentation: GameClientPresentation;
            } & GameClientPuzzles<C>
          : { readonly presentation?: never; readonly puzzles?: never }) &
        GameClientContent<G>
    : never;

type GameClientParts = {
  /** The game's name, in the game choice and above its own choices. */
  readonly title: string;
  /** One line under the name in the game choice. */
  readonly caption: string;
  /** One line under the name above the game's choices. */
  readonly subtitle: () => JSX.Element;
  /** How to play, under the game's choices. */
  readonly instructions?: () => JSX.Element;
  /** The game's own choices, offered before the shared ones. */
  readonly choices?: readonly GameChoice[];
  /** The game's settings, offered last under the shared name. */
  readonly settings?: Omit<GameChoice, 'screen' | 'title'>;
  /** Further screens the game's own screens and links open. */
  readonly screens?: readonly GameOwnScreen[];
  /** Wraps every screen of the game (shared data the game's screens read). */
  readonly Frame?: (props: { children: JSX.Element }) => JSX.Element;
  readonly SessionEffects?: () => JSX.Element;
};

/**
 * A game's client as the client registry lists it. Only
 * {@link defineGameClient} makes one: its private brand is not copied by a
 * spread or met by a hand-built object, so a registered client always has
 * its screens checked and is offered through the one `GameMenu`.
 */
class DefinedGameClient implements GameClientDefinition {
  readonly #defined = true;
  readonly id: string;
  readonly title: string;
  readonly caption: string;
  /** The family its modes share, for a game with rules. */
  declare readonly family?: string;
  declare readonly presentation?: GamePresentation<JSX.Element>;
  declare readonly puzzleContent?: PuzzleContentClient;
  readonly MainMenu: GameClientDefinition['MainMenu'];
  /** The game's puzzles part, when it offers puzzles. */
  declare readonly puzzles?: GamePuzzlesClient;
  declare readonly SessionEffects?: () => JSX.Element;

  constructor(game: GameClient) {
    const id = game.shared.id;
    this.id = id;
    this.title = game.title;
    this.caption = game.caption;
    const rules = game.shared.registration?.rules;
    if (rules !== undefined) this.family = gameFamily(rules);
    if (game.presentation !== undefined)
      this.presentation = { ...game.presentation, id };
    if (game.puzzleContent !== undefined)
      this.puzzleContent = game.puzzleContent;
    this.MainMenu = (props) => (
      <GameMenu game={game} onBackToGames={props.onBackToGames} />
    );
    const puzzles = game.puzzles;
    if (puzzles !== undefined) this.puzzles = puzzles;
    const own = game.SessionEffects;
    if (puzzles !== undefined)
      this.SessionEffects = () => (
        <>
          <PuzzleSessionEffects gameId={id} puzzles={puzzles} />
          {own === undefined ? null : own()}
        </>
      );
    else if (own !== undefined) this.SessionEffects = own;
  }

  /** Whether `value` was made by {@link defineGameClient}. */
  static made(value: unknown): value is DefinedGameClient {
    return typeof value === 'object' && value !== null && #defined in value;
  }
}

export type GameClientRegistration<
  G extends AnyGameRegistration = AnyGameRegistration,
> = DefinedGameClient &
  GameClientContent<G> &
  (G extends GameRegistration
    ? { readonly presentation: GamePresentation<JSX.Element> }
    : unknown);

/**
 * The puzzles part agrees with the shared registration: present exactly
 * when the game offers puzzles, with its board.
 */
function assertPuzzlesPart(game: GameClient): void {
  const id = game.shared.id;
  const offered = game.shared.registration?.capabilities.puzzles !== undefined;
  if (offered && game.puzzles === undefined)
    throw new Error(
      `${id}: the game offers puzzles (capabilities.puzzles) but its client has no puzzles part — give defineGameClient puzzles: { Board, … }`
    );
  if (!offered && game.puzzles !== undefined)
    throw new Error(
      `${id}: the client has a puzzles part but the game offers no puzzles — add capabilities.puzzles to its defineGame, or leave the part out`
    );
  if (game.puzzles !== undefined && typeof game.puzzles.Board !== 'function')
    throw new Error(
      `${id}: puzzles.Board is missing — the platform's puzzle screens show the game's own board`
    );
}

/** A game with private setups shows its own setup board; no other game has one. */
function assertSetupBoard(game: GameClient): void {
  const id = game.shared.id;
  const setups = game.shared.registration?.rules.setup !== undefined;
  const board = game.presentation?.SetupBoard;
  if (setups && typeof board !== 'function')
    throw new Error(
      `${id}: its sides prepare private setups (rules.setup) but its presentation has no SetupBoard — the shared screens show the game's own setup board`
    );
  if (!setups && board !== undefined)
    throw new Error(
      `${id}: the presentation has a SetupBoard but its rules have no private setup — add rules.setup, or leave the board out`
    );
}

/** The frame agrees with the game's rules; puzzle content labels its figures. */
function assertFrames(game: GameClient): void {
  const rules = game.shared.registration?.rules;
  if (rules !== undefined && game.presentation !== undefined)
    assertFrame(game.shared.id, rules, game.presentation.frame);
  if (game.puzzleContent !== undefined)
    assertContentFrame(game.shared.id, game.puzzleContent);
}

/** The one way a game joins the space's game choice. */
export function defineGameClient<G extends AnyGameRegistration>(
  game: GameClient<G> & { readonly shared: G }
): GameClientRegistration<G> {
  assertGameDefinitions('defineGameClient.shared', [game.shared]);
  assertContentPart(game);
  assertPuzzlesPart(game);
  assertSetupBoard(game);
  assertFrames(game);
  if (
    game.shared.registration?.capabilities.matchmaking?.clockChoices === true &&
    typeof game.presentation?.timeoutDrawDescription !== 'function'
  )
    throw new Error(
      `${game.shared.id}: clock choices need presentation.timeoutDrawDescription`
    );
  assertGameScreens(game.shared.id, [
    ...(game.choices ?? []).map((choice) => choice.screen),
    ...(game.screens ?? []).map((screen) => screen.screen),
  ]);
  return new DefinedGameClient(game) as GameClientRegistration<G>;
}

function assertContentPart(game: GameClient): void {
  const content = game.puzzleContent;
  if (game.shared.puzzleContent === undefined && content !== undefined)
    throw new Error(
      `${game.shared.id}: the client offers puzzle rendering but the game offers no puzzle content`
    );
  if (
    game.shared.puzzleContent !== undefined &&
    typeof content?.Player !== 'function'
  )
    throw new Error(
      `${game.shared.id}: puzzleContent.Player is required for its puzzle rules`
    );
  if (
    content?.authoring !== undefined &&
    (typeof content.authoring.Editor !== 'function' ||
      typeof content.authoring.initialDefinition !== 'function')
  )
    throw new Error(
      `${game.shared.id}: puzzle authoring requires its Editor and initialDefinition`
    );
  if (content?.Preview !== undefined && typeof content.Preview !== 'function')
    throw new Error(
      `${game.shared.id}: puzzleContent.Preview must be a component`
    );
}

/**
 * Fail, naming the entry, when a registry lists a client
 * {@link defineGameClient} did not make (a copy, a hand-built object).
 */
export function assertGameClientDefinitions(
  registry: string,
  clients: readonly unknown[]
): void {
  for (const [index, client] of clients.entries()) {
    if (DefinedGameClient.made(client)) continue;
    const id =
      typeof client === 'object' && client !== null && 'id' in client
        ? String(client.id)
        : '?';
    throw new Error(
      `${registry}[${String(index)}] (${id}) was not made by defineGameClient — register the game's defineGameClient(...) value itself, never a copy or a hand-built client`
    );
  }
}
