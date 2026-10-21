import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { useSpacePresence } from './public-use-space-presence';
import { openSpaceDetail } from './space-routes';
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
  const presence = useSpacePresence(() => props.spaceId);
  const resolvedTitle = useSpaceDisplayTitle(() => props.spaceId);
  const hostUsername = useSpaceHostUsername(() => props.spaceId);
  const accessibilityLabel = createMemo(() => {
    const override = props.accessibilityLabelOverride;
    if (override !== undefined) return override;
    return presence().status === 'active'
      ? t`Open current space ${resolvedTitle()}`
      : t`Open space ${resolvedTitle()}`;
  });
  const testId = createMemo<string | null>(() => {
    if (props.testId !== undefined) return props.testId;
    const host = hostUsername();
    return host !== null ? Handles.spaceCard(host) : null;
  });
  return (
    <Pressable
      width="full"
      testId={testId() ?? undefined}
      onPress={() => {
        openSpaceDetail(router, props.spaceId);
      }}
      aria-label={accessibilityLabel()}
    >
      {props.children}
    </Pressable>
  );
}
