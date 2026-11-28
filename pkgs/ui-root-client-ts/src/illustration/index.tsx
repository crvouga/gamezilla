/** @jsxImportSource @solidjs/web */
import { componentDataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import artistPaletteImage from '../../assets/fluent-emoji/artist-palette.webp?inline';
import barChartImage from '../../assets/fluent-emoji/bar-chart.webp?inline';
import bellImage from '../../assets/fluent-emoji/bell.webp?inline';
import booksImage from '../../assets/fluent-emoji/books.webp?inline';
import cardFileBoxImage from '../../assets/fluent-emoji/card-file-box.webp?inline';
import crossedSwordsImage from '../../assets/fluent-emoji/crossed-swords.webp?inline';
import gearImage from '../../assets/fluent-emoji/gear.webp?inline';
import handshakeImage from '../../assets/fluent-emoji/handshake.webp?inline';
import identificationCardImage from '../../assets/fluent-emoji/identification-card.webp?inline';
import magnifyingGlassTiltedLeftImage from '../../assets/fluent-emoji/magnifying-glass-tilted-left.webp?inline';
import mantelpieceClockImage from '../../assets/fluent-emoji/mantelpiece-clock.webp?inline';
import mobilePhoneImage from '../../assets/fluent-emoji/mobile-phone.webp?inline';
import openBookImage from '../../assets/fluent-emoji/open-book.webp?inline';
import puzzlePieceImage from '../../assets/fluent-emoji/puzzle-piece.webp?inline';
import robotImage from '../../assets/fluent-emoji/robot.webp?inline';
import sportsMedalImage from '../../assets/fluent-emoji/sports-medal.webp?inline';
import stopwatchImage from '../../assets/fluent-emoji/stopwatch.webp?inline';
import trophyImage from '../../assets/fluent-emoji/trophy.webp?inline';
import videoGameImage from '../../assets/fluent-emoji/video-game.webp?inline';
import wastebasketImage from '../../assets/fluent-emoji/wastebasket.webp?inline';
import wrappedGiftImage from '../../assets/fluent-emoji/wrapped-gift.webp?inline';
import type { IconProps } from '../create-icon/index';

function illustration(src: string) {
  return function Illustration(
    props: Pick<IconProps, 'size' | 'dataSet'>
  ): JSX.Element {
    return (
      <img
        {...componentDataAttrs('Illustration', props.dataSet)}
        src={src}
        decoding="sync"
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

export const VictoryArt = /* @__PURE__ */ illustration(trophyImage);
const Handshake = /* @__PURE__ */ illustration(handshakeImage);

/** The decorative Handshake illustration for friends and human opponents. */
export function FriendsArt(
  props: Pick<IconProps, 'size' | 'dataSet'>
): JSX.Element {
  return <Handshake {...props} />;
}
export const AutomationArt = /* @__PURE__ */ illustration(robotImage);
export const TournamentsArt = /* @__PURE__ */ illustration(sportsMedalImage);
export const GamesArt = /* @__PURE__ */ illustration(videoGameImage);
export const SearchArt = /* @__PURE__ */ illustration(
  magnifyingGlassTiltedLeftImage
);
export const HistoryArt = /* @__PURE__ */ illustration(mantelpieceClockImage);
export const BooksArt = /* @__PURE__ */ illustration(booksImage);
export const StatsArt = /* @__PURE__ */ illustration(barChartImage);
export const PuzzleArt = /* @__PURE__ */ illustration(puzzlePieceImage);
export const DeviceArt = /* @__PURE__ */ illustration(mobilePhoneImage);
export const ThemeArt = /* @__PURE__ */ illustration(artistPaletteImage);
export const RewardsArt = /* @__PURE__ */ illustration(wrappedGiftImage);
export const MatchmakingArt = /* @__PURE__ */ illustration(crossedSwordsImage);
export const RulesArt = /* @__PURE__ */ illustration(openBookImage);
export const ProfileArt = /* @__PURE__ */ illustration(identificationCardImage);
export const SettingsArt = /* @__PURE__ */ illustration(gearImage);
export const NotificationsArt = /* @__PURE__ */ illustration(bellImage);
export const ArchiveArt = /* @__PURE__ */ illustration(cardFileBoxImage);

export const RemoveArt = /* @__PURE__ */ illustration(wastebasketImage);

export const TimeControlArt = /* @__PURE__ */ illustration(stopwatchImage);
