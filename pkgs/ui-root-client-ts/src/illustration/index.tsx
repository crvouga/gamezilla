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
  new URL('../../assets/fluent-emoji/trophy.svg', import.meta.url).href
);
export const ChessArt = illustration(
  new URL('../../assets/fluent-emoji/chess-pawn.svg', import.meta.url).href
);
export const DiscsArt = illustration(
  new URL('../../assets/fluent-emoji/red-circle.svg', import.meta.url).href
);
export const FleetArt = illustration(
  new URL('../../assets/fluent-emoji/ship.svg', import.meta.url).href
);
export const CardsArt = illustration(
  new URL('../../assets/fluent-emoji/heart-suit.svg', import.meta.url).href
);
export const WallsArt = illustration(
  new URL('../../assets/fluent-emoji/brick.svg', import.meta.url).href
);
export const LettersArt = illustration(
  new URL('../../assets/fluent-emoji/input-latin-letters.svg', import.meta.url)
    .href
);
export const CratesArt = illustration(
  new URL('../../assets/fluent-emoji/package.svg', import.meta.url).href
);
export const PathsArt = illustration(
  new URL('../../assets/fluent-emoji/link.svg', import.meta.url).href
);
export const CourtArt = illustration(
  new URL('../../assets/fluent-emoji/ping-pong.svg', import.meta.url).href
);
export const TrailsArt = illustration(
  new URL('../../assets/fluent-emoji/motorcycle.svg', import.meta.url).href
);
const HuggingPeople = illustration(
  new URL('../../assets/fluent-emoji/people-hugging.svg', import.meta.url).href
);

/** The decorative People Hugging illustration for friends and human opponents. */
export function FriendsArt(
  props: Pick<IconProps, 'size' | 'dataSet'>
): JSX.Element {
  return <HuggingPeople {...props} />;
}
export const BotArt = illustration(
  new URL('../../assets/fluent-emoji/robot.svg', import.meta.url).href
);
export const TournamentsArt = illustration(
  new URL('../../assets/fluent-emoji/sports-medal.svg', import.meta.url).href
);
export const GamesArt = illustration(
  new URL('../../assets/fluent-emoji/video-game.svg', import.meta.url).href
);
export const SearchArt = illustration(
  new URL(
    '../../assets/fluent-emoji/magnifying-glass-tilted-left.svg',
    import.meta.url
  ).href
);
export const HistoryArt = illustration(
  new URL('../../assets/fluent-emoji/mantelpiece-clock.svg', import.meta.url)
    .href
);
export const BooksArt = illustration(
  new URL('../../assets/fluent-emoji/books.svg', import.meta.url).href
);
export const StatsArt = illustration(
  new URL('../../assets/fluent-emoji/bar-chart.svg', import.meta.url).href
);
export const PuzzleArt = illustration(
  new URL('../../assets/fluent-emoji/puzzle-piece.svg', import.meta.url).href
);
export const DeviceArt = illustration(
  new URL('../../assets/fluent-emoji/mobile-phone.svg', import.meta.url).href
);
export const ThemeArt = illustration(
  new URL('../../assets/fluent-emoji/artist-palette.svg', import.meta.url).href
);
export const RewardsArt = illustration(
  new URL('../../assets/fluent-emoji/wrapped-gift.svg', import.meta.url).href
);
export const MatchmakingArt = illustration(
  new URL('../../assets/fluent-emoji/crossed-swords.svg', import.meta.url).href
);
export const RulesArt = illustration(
  new URL('../../assets/fluent-emoji/open-book.svg', import.meta.url).href
);
export const ProfileArt = illustration(
  new URL('../../assets/fluent-emoji/bust-in-silhouette.svg', import.meta.url)
    .href
);
export const SpacesArt = illustration(
  new URL('../../assets/fluent-emoji/house.svg', import.meta.url).href
);
export const NotificationsArt = illustration(
  new URL('../../assets/fluent-emoji/bell.svg', import.meta.url).href
);
export const ArchiveArt = illustration(
  new URL('../../assets/fluent-emoji/card-file-box.svg', import.meta.url).href
);
