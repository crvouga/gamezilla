import { Handles } from '@libs/test-ids-shared/handles';
import { useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { openSpaceDetail } from './space-routes';
import { useIsSpaceOpenLocally } from './use-open-space-session-ids';
import { useSpaceDisplayTitle } from './use-space-display-title';
import { useSpaceHostUsername } from './use-space-host-username';

export type SpaceCardOpenLinkProps = {
  spaceId: string;
  children: JSX.Element;
  accessibilityLabelOverride?: string;
  /** Test id override; `null` renders none, `undefined` derives from the host. */
  testId?: string | null;
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
  const testId = createMemo<string | null>(() => {
    if (props.testId !== undefined) return props.testId;
    const host = hostUsername();
    return host !== null ? Handles.spaceCard(host) : null;
  });
  return (
    <button
      class="clickable clickableTint w-full text-left"
      {...dataAttrs(testId() !== null ? { testid: testId() ?? '' } : undefined)}
      type="button"
      onClick={() => openSpaceDetail(router, props.spaceId)}
      aria-label={accessibilityLabel()}
    >
      {props.children}
    </button>
  );
}
