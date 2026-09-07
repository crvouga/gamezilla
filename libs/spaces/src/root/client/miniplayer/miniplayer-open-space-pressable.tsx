import { useLingui } from '@lingui/solid/macro';
import { Clickable, useRouter } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { openSpaceDetail } from '../../../public/space-routes';

export type MiniplayerOpenSpacePressableProps = {
  spaceId: string;
  children: JSX.Element;
  /** Optional hook after navigation is triggered (e.g. close a sheet). */
  onAfterOpen?: () => void;
};

/** A press target that returns to a space — owns the route mapping. */
export function MiniplayerOpenSpacePressable(
  props: MiniplayerOpenSpacePressableProps
): JSX.Element {
  const router = useRouter();
  const { t } = useLingui();
  return (
    <Clickable
      onClick={() => {
        openSpaceDetail(router, props.spaceId);
        props.onAfterOpen?.();
      }}
      role="button"
      aria-label={t`Tap to return to your space`}
      sx={{
        flex: 1,
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        minWidth: 0,
      }}
    >
      {props.children}
    </Clickable>
  );
}
