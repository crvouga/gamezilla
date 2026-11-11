import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import type { ScreenBaseBreadcrumb } from '@pkgs/ui-root-client-ts/screen-base-types';
import type { JSX } from 'solid-js';
import type { PuzzleStatsPlace } from './puzzle-stats-places';

export type PersonalPuzzleStatsScreenViewProps = {
  /** The route's own screen id (one per game). */
  readonly screenId: string;
  /** The stats' small screen shown; the breadcrumbs lead back from it. */
  readonly place: PuzzleStatsPlace;
  readonly onOpen: (place: PuzzleStatsPlace) => void;
  /** The body of `place` (`PuzzleStatsScreenView`, nested). */
  readonly children: JSX.Element;
};

/** The crumb of a place under the stats, and the one it is reached through. */
function placeCrumbs(
  props: PersonalPuzzleStatsScreenViewProps
): readonly ScreenBaseBreadcrumb[] {
  const log: ScreenBaseBreadcrumb = { name: <Trans>Game log</Trans> };
  if (props.place.screen === 'trend')
    return [{ name: <Trans>Rating trend</Trans> }];
  if (props.place.screen === 'log') return [log];
  if (props.place.screen === 'review')
    return [
      { ...log, onClick: () => props.onOpen({ screen: 'log' }) },
      { name: <Trans>Puzzle review</Trans> },
    ];
  return [];
}

/**
 * A game's puzzle stats outside any space (from Settings), presentational:
 * the routed page edge and its breadcrumbs around the stats' small screens
 * (the summary, the rating trend, the game log, the review of one logged
 * puzzle). Each crumb leads back to the screen it names.
 * `PersonalPuzzleStatsScreen` supplies the body.
 */
export function PersonalPuzzleStatsScreenView(
  props: PersonalPuzzleStatsScreenViewProps
): JSX.Element {
  const onward = (): readonly ScreenBaseBreadcrumb[] => placeCrumbs(props);
  return (
    <ContentScreen
      screenId={props.screenId}
      width="menu"
      breadcrumbs={[
        { name: <Trans>Settings</Trans>, href: '/more' },
        {
          name: <Trans>Puzzle stats</Trans>,
          ...(onward().length > 0
            ? { onClick: () => props.onOpen({ screen: 'summary' }) }
            : {}),
        },
        ...onward(),
      ]}
    >
      {props.children}
    </ContentScreen>
  );
}
