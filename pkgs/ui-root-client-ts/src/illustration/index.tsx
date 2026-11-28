/** @jsxImportSource @solidjs/web */
import { componentDataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import type { IconProps } from '../create-icon/index';

function illustration(src: string) {
  return function Illustration(
    props: Pick<IconProps, 'size' | 'dataSet'>
  ): JSX.Element {
    return (
      <img
        {...componentDataAttrs('Illustration', props.dataSet)}
        src={src}
        alt=""
        aria-hidden="true"
        width={props.size ?? 32}
        height={props.size ?? 32}
        class="shrink-0"
      />
    );
  };
}

export const VictoryArt = illustration(
  new URL('./trophy.svg', import.meta.url).href
);
export const ChessArt = illustration(
  new URL('./chess-pawn.svg', import.meta.url).href
);
export const DiscsArt = illustration(
  new URL('./red-circle.svg', import.meta.url).href
);
export const FleetArt = illustration(
  new URL('./ship.svg', import.meta.url).href
);
export const CardsArt = illustration(
  new URL('./heart-suit.svg', import.meta.url).href
);
export const WallsArt = illustration(
  new URL('./brick.svg', import.meta.url).href
);
export const LettersArt = illustration(
  new URL('./input-latin-letters.svg', import.meta.url).href
);
export const CratesArt = illustration(
  new URL('./package.svg', import.meta.url).href
);
export const PathsArt = illustration(
  new URL('./link.svg', import.meta.url).href
);
export const CourtArt = illustration(
  new URL('./ping-pong.svg', import.meta.url).href
);
export const TrailsArt = illustration(
  new URL('./motorcycle.svg', import.meta.url).href
);
export const FriendsArt = illustration(
  new URL('./people-hugging.svg', import.meta.url).href
);
export const BotArt = illustration(
  new URL('./robot.svg', import.meta.url).href
);
export const TournamentsArt = illustration(
  new URL('./sports-medal.svg', import.meta.url).href
);
export const GamesArt = illustration(
  new URL('./video-game.svg', import.meta.url).href
);
export const SearchArt = illustration(
  new URL('./magnifying-glass-tilted-left.svg', import.meta.url).href
);
export const HistoryArt = illustration(
  new URL('./mantelpiece-clock.svg', import.meta.url).href
);
export const BooksArt = illustration(
  new URL('./books.svg', import.meta.url).href
);
export const StatsArt = illustration(
  new URL('./bar-chart.svg', import.meta.url).href
);
export const PuzzleArt = illustration(
  new URL('./puzzle-piece.svg', import.meta.url).href
);
export const DeviceArt = illustration(
  new URL('./mobile-phone.svg', import.meta.url).href
);
export const ThemeArt = illustration(
  new URL('./artist-palette.svg', import.meta.url).href
);
export const RewardsArt = illustration(
  new URL('./wrapped-gift.svg', import.meta.url).href
);
export const MatchmakingArt = illustration(
  new URL('./crossed-swords.svg', import.meta.url).href
);
export const RulesArt = illustration(
  new URL('./open-book.svg', import.meta.url).href
);
export const ProfileArt = illustration(
  new URL('./bust-in-silhouette.svg', import.meta.url).href
);
export const SpacesArt = illustration(
  new URL('./house.svg', import.meta.url).href
);
export const NotificationsArt = illustration(
  new URL('./bell.svg', import.meta.url).href
);
export const ArchiveArt = illustration(
  new URL('./card-file-box.svg', import.meta.url).href
);
