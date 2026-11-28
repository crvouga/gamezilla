/** @jsxImportSource @solidjs/web */
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { dynamic, type JSX } from '@solidjs/web';
import {
  CardsArt,
  ChessArt,
  CourtArt,
  CratesArt,
  DiscsArt,
  FleetArt,
  LettersArt,
  PathsArt,
  TrailsArt,
  WallsArt,
} from '../illustration/index';
import styles from './game-tile.module.css';

/** The artwork identifying each game in the catalog and its menu. */
export type GameTileMotif =
  | 'checkered'
  | 'discs'
  | 'fleet'
  | 'cards'
  | 'walls'
  | 'letters'
  | 'crates'
  | 'paths'
  | 'court'
  | 'trails';

/** Every motif, in a stable order (stories, conformance). */
export const GAME_TILE_MOTIFS: readonly GameTileMotif[] = [
  'checkered',
  'discs',
  'fleet',
  'cards',
  'walls',
  'letters',
  'crates',
  'paths',
  'court',
  'trails',
];

/**
 * `md` 32px beside a row's title; `lg` 48px beside a game's name; `xl`
 * 80px heading a game's own menu on a wide screen.
 */
export type GameTileSize = 'md' | 'lg' | 'xl';

export type GameTileProps = {
  motif: GameTileMotif;
  /** Defaults to `md`. */
  size?: GameTileSize | undefined;
  dataSet?: ComponentDataSet | undefined;
};

const ART = {
  checkered: ChessArt,
  discs: DiscsArt,
  fleet: FleetArt,
  cards: CardsArt,
  walls: WallsArt,
  letters: LettersArt,
  crates: CratesArt,
  paths: PathsArt,
  court: CourtArt,
  trails: TrailsArt,
} satisfies Record<GameTileMotif, typeof ChessArt>;

const SIZE = { md: 32, lg: 48, xl: 80 } satisfies Record<GameTileSize, number>;

export function GameTile(props: GameTileProps): JSX.Element {
  const Art = dynamic(() => ART[props.motif]);
  return (
    <span
      class="box shrink-0 items-center justify-center"
      data-motif={props.motif}
      data-size={props.size ?? 'md'}
      aria-hidden="true"
      {...dataAttrs({ component: 'GameTile', ...props.dataSet })}
    >
      <Art size={SIZE[props.size ?? 'md']} />
    </span>
  );
}

/**
 * `GameTitleLockup` -- a game's name with its `GameTile` before it, for the
 * title that opens the game's own menu. Lives inside the heading, so the
 * heading still reads as the game's name alone (the tile is decorative).
 */
export function GameTitleLockup(props: {
  /** A `GameTile` (`size="lg"` beside a screen title). */
  tile: JSX.Element;
  children: JSX.Element;
}): JSX.Element {
  return (
    <span
      class={styles['lockup']}
      {...dataAttrs({ component: 'GameTitleLockup' })}
    >
      {props.tile}
      <span class={styles['lockupName']}>{props.children}</span>
    </span>
  );
}
