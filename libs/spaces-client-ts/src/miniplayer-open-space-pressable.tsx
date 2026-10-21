import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import type { SpaceToken } from '@pkgs/ui-root-shared-ts/token-names';
import type { JSX } from 'solid-js';

import { openSpaceDetail } from './space-routes';

export type MiniplayerOpenSpacePressableProps = {
  spaceId: string;
  children: JSX.Element;
  /** Inset before the content: the bar's edge, or the sheet list's. */
  paddingStart: SpaceToken;
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
    <Pressable
      grow
      self="stretch"
      direction="horizontal"
      align="center"
      gap="sm"
      paddingY="md"
      paddingStart={props.paddingStart}
      testId={Handles.spaceMiniplayerOpen(props.spaceId)}
      onPress={() => {
        openSpaceDetail(router, props.spaceId);
        props.onAfterOpen?.();
      }}
      aria-label={t`Tap to return to your space`}
    >
      {props.children}
    </Pressable>
  );
}
