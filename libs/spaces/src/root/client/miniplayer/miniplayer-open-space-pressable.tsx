import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui';
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
    <button
      class="clickable clickableTint flex-1 self-stretch flex-row items-center gap-2 min-w-0"
      data-testid={Handles.spaceMiniplayerOpen(props.spaceId)}
      type="button"
      onClick={() => {
        openSpaceDetail(router, props.spaceId);
        props.onAfterOpen?.();
      }}
      role="button"
      aria-label={t`Tap to return to your space`}
    >
      {props.children}
    </button>
  );
}
