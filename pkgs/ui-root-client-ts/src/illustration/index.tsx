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
        data-icon-family="artwork"
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
  new URL('../../assets/fluent-emoji/trophy.webp', import.meta.url).href
);
const HuggingPeople = illustration(
  new URL('../../assets/fluent-emoji/people-hugging.webp', import.meta.url).href
);

/** The decorative People Hugging illustration for friends and human opponents. */
export function FriendsArt(
  props: Pick<IconProps, 'size' | 'dataSet'>
): JSX.Element {
  return <HuggingPeople {...props} />;
}
export const AutomationArt = illustration(
  new URL('../../assets/fluent-emoji/robot.webp', import.meta.url).href
);
export const TournamentsArt = illustration(
  new URL('../../assets/fluent-emoji/sports-medal.webp', import.meta.url).href
);
export const GamesArt = illustration(
  new URL('../../assets/fluent-emoji/video-game.webp', import.meta.url).href
);
export const SearchArt = illustration(
  new URL(
    '../../assets/fluent-emoji/magnifying-glass-tilted-left.webp',
    import.meta.url
  ).href
);
export const HistoryArt = illustration(
  new URL('../../assets/fluent-emoji/mantelpiece-clock.webp', import.meta.url)
    .href
);
export const BooksArt = illustration(
  new URL('../../assets/fluent-emoji/books.webp', import.meta.url).href
);
export const StatsArt = illustration(
  new URL('../../assets/fluent-emoji/bar-chart.webp', import.meta.url).href
);
export const PuzzleArt = illustration(
  new URL('../../assets/fluent-emoji/puzzle-piece.webp', import.meta.url).href
);
export const DeviceArt = illustration(
  new URL('../../assets/fluent-emoji/mobile-phone.webp', import.meta.url).href
);
export const ThemeArt = illustration(
  new URL('../../assets/fluent-emoji/artist-palette.webp', import.meta.url).href
);
export const RewardsArt = illustration(
  new URL('../../assets/fluent-emoji/wrapped-gift.webp', import.meta.url).href
);
export const MatchmakingArt = illustration(
  new URL('../../assets/fluent-emoji/crossed-swords.webp', import.meta.url).href
);
export const RulesArt = illustration(
  new URL('../../assets/fluent-emoji/open-book.webp', import.meta.url).href
);
export const ProfileArt = illustration(
  new URL('../../assets/fluent-emoji/identification-card.webp', import.meta.url)
    .href
);
export const SettingsArt = illustration(
  new URL('../../assets/fluent-emoji/gear.webp', import.meta.url).href
);
export const NotificationsArt = illustration(
  new URL('../../assets/fluent-emoji/bell.webp', import.meta.url).href
);
export const ArchiveArt = illustration(
  new URL('../../assets/fluent-emoji/card-file-box.webp', import.meta.url).href
);

export const RemoveArt = illustration(
  new URL('../../assets/fluent-emoji/wastebasket.webp', import.meta.url).href
);

export const TimeControlArt = illustration(
  new URL('../../assets/fluent-emoji/stopwatch.webp', import.meta.url).href
);
