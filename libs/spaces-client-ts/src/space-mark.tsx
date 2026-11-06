import {
  MonogramTile,
  type MonogramTileSize,
} from '@pkgs/ui-root-client-ts/monogram-tile';
import type { JSX } from 'solid-js';
import { useSpaceDisplayTitle } from './use-space-display-title';

export type SpaceMarkViewProps = {
  readonly spaceId: string;
  /** The room's name, as shown beside the mark. */
  readonly title: string;
  /** Defaults to `md` (40px, a row's mark). */
  readonly size?: MonogramTileSize | undefined;
};

/**
 * A space's own mark: its colour (stable for its id, the same on every
 * device and screen) and its name's initial. A space is a room, not a
 * person, so it never borrows its host's face; the host's face, where it
 * helps, is secondary information beside it.
 */
export function SpaceMarkView(props: SpaceMarkViewProps): JSX.Element {
  return (
    <MonogramTile
      name={props.title}
      seed={props.spaceId}
      size={props.size ?? 'md'}
    />
  );
}

/** {@link SpaceMarkView} for a synced space, titled as everywhere else. */
export function SpaceMark(props: {
  readonly spaceId: string;
  readonly size?: MonogramTileSize | undefined;
}): JSX.Element {
  const title = useSpaceDisplayTitle(() => props.spaceId);
  return (
    <SpaceMarkView spaceId={props.spaceId} title={title()} size={props.size} />
  );
}
