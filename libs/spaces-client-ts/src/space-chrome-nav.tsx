import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import { useActionBarChrome } from '@pkgs/ui-root-client-ts/action-bar-chrome';
import { actionBarGlyphSize } from '@pkgs/ui-root-client-ts/action-bar-logic';
import {
  ChromeBreadcrumb,
  type ChromeCrumb,
} from '@pkgs/ui-root-client-ts/chrome-breadcrumb';
import { ChromeTitle } from '@pkgs/ui-root-client-ts/chrome-title';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import { ChevronLeftIcon } from '@pkgs/ui-root-client-ts/icons';
import { MonogramTile } from '@pkgs/ui-root-client-ts/monogram-tile';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import { spaceBackName, spaceTrail } from './space-chrome-trail';

/** Where the person is in the space, and the way back inside it. */
export type SpaceChromeNavProps = {
  /** The room's name. */
  readonly title: string;
  /** Seeds the room's tile; no tile without it. */
  readonly spaceId?: string | undefined;
  /** The selected game's name; `undefined` on the space's list of games. */
  readonly place?: string | undefined;
  /** Back inside the space; null on the space's list of games. */
  readonly onPressBack: (() => void) | null;
  /** Where Back goes ("Games", "Chess"), when the screen named it. */
  readonly backLabel?: string | undefined;
  /**
   * A phone's way out at the room's root (the space's list of games), back
   * to Spaces while the space goes on small: shown as ‹ with "Spaces" over
   * the room's name. Absent where the bar offers no such way.
   */
  readonly onPressSpaces?: (() => void) | undefined;
};

function trailInput(props: SpaceChromeNavProps) {
  return {
    place: props.place,
    hasBack: props.onPressBack !== null,
    backLabel: props.backLabel,
    room: props.title,
  };
}

/** The room's name, alone the handle the harness reads it by. */
function RoomName(props: { readonly title: string }): JSX.Element {
  return (
    <Text variant="inherit" testId={Handles.spaceTitle}>
      {props.title}
    </Text>
  );
}

/**
 * Beside the sidebar: the room (with its tile), then the selected game, as
 * one trail. Its one link is the way back, named for where it goes: the
 * room from a game's own menu, the game from a screen the game opens.
 * Minimize is not here: it is a separate control at the bar's far edge.
 */
export function SpaceChromeTrail(props: SpaceChromeNavProps): JSX.Element {
  const trail = createMemo(() => spaceTrail(trailInput(props)));
  const back = (role: string): (() => void) | undefined =>
    role === 'parent' ? (props.onPressBack ?? undefined) : undefined;
  const crumbs = createMemo((): ChromeCrumb[] => {
    const room: ChromeCrumb = {
      name: <RoomName title={props.title} />,
      onClick: back(trail().room),
      linkTestId: trail().room === 'parent' ? Handles.navBack : undefined,
      leading:
        props.spaceId === undefined ? undefined : (
          <MonogramTile name={props.title} seed={props.spaceId} size="sm" />
        ),
    };
    const place = props.place;
    const placeRole = trail().place;
    if (place === undefined || placeRole === null) return [room];
    return [
      room,
      {
        name: place,
        onClick: back(placeRole),
        linkTestId: placeRole === 'parent' ? Handles.navBack : undefined,
      },
    ];
  });
  return <ChromeBreadcrumb size="subtitle" crumbs={crumbs()} />;
}

/**
 * A phone's ‹, named for where it goes: the parent place while there is a
 * way back inside the space; at the room's root, Spaces (`onPressSpaces`),
 * so the way out of the room is never only Minimize's glyph at the far
 * edge. Minimize is never a second leading glyph.
 */
export function SpaceChromeBack(props: SpaceChromeNavProps): JSX.Element {
  const { t } = useLingui();
  const chrome = useActionBarChrome();
  const name = (): string => spaceBackName(trailInput(props)) ?? t`Back`;
  const chevron = (): JSX.Element => (
    <ChevronLeftIcon
      size={actionBarGlyphSize(chrome().buttonSize)}
      color="icon"
    />
  );
  return (
    <Show
      when={props.onPressBack}
      fallback={
        <Show when={props.onPressSpaces}>
          {(onPressSpaces) => (
            <IconButton
              label={t`Spaces`}
              size={chrome().buttonSize}
              onClick={() => onPressSpaces()()}
              dataSet={{ testid: Handles.spaceBackToSpaces }}
            >
              {chevron()}
            </IconButton>
          )}
        </Show>
      }
    >
      {(onPressBack) => (
        <IconButton
          label={name()}
          size={chrome().buttonSize}
          onClick={() => onPressBack()()}
          dataSet={{ testid: Handles.navBack }}
        >
          {chevron()}
        </IconButton>
      )}
    </Show>
  );
}

/**
 * A phone's title: on the space's list of games the room, under "Spaces"
 * where ‹ leads there; inside a game, the room's name small over the
 * game's. Either way the small line names where ‹ goes.
 */
export function SpaceChromeCompactTitle(
  props: SpaceChromeNavProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical shrink>
      <Show
        when={props.place}
        fallback={
          <ChromeTitle
            eyebrow={
              props.onPressBack === null && props.onPressSpaces !== undefined
                ? t`Spaces`
                : undefined
            }
          >
            <RoomName title={props.title} />
          </ChromeTitle>
        }
      >
        {(place) => (
          <ChromeTitle eyebrow={<RoomName title={props.title} />}>
            {place()}
          </ChromeTitle>
        )}
      </Show>
    </StackVertical>
  );
}
