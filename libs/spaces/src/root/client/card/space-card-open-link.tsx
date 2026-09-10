import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/solid/macro';
import { dataAttrs, useRouter } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { openSpaceDetail } from '../../../public/space-routes';
import { useIsSpaceOpenLocally } from '../../../use-cases/list-open-sessions/client/use-open-space-session-ids';
import { useSpaceDisplayTitle } from '../use-space-display-title';
import { useSpaceHostUsername } from '../use-space-host-username';

export type SpaceCardOpenLinkProps = {
  spaceId: string;
  children: JSX.Element;
  accessibilityLabelOverride?: string;
};

export function SpaceCardOpenLink(props: SpaceCardOpenLinkProps): JSX.Element {
  const router = useRouter();
  const { t } = useLingui();
  const isOpen = useIsSpaceOpenLocally(() => props.spaceId);
  const resolvedTitle = useSpaceDisplayTitle(() => props.spaceId);
  const hostUsername = useSpaceHostUsername(() => props.spaceId);
  const accessibilityLabel = createMemo(() => {
    const override = props.accessibilityLabelOverride;
    if (override !== undefined) return override;
    return isOpen()
      ? t`Open current space ${resolvedTitle()}`
      : t`Open space ${resolvedTitle()}`;
  });
  return (
    <button
      class="clickable clickableTint"
      {...dataAttrs(
        hostUsername() !== null
          ? { testid: Handles.spaceCard(hostUsername() ?? '') }
          : undefined
      )}
      type="button"
      onClick={() => openSpaceDetail(router, props.spaceId)}
      aria-label={accessibilityLabel()}
    >
      {props.children}
    </button>
  );
}
