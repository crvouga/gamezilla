import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import type { JSX } from 'solid-js';

/**
 * The account privacy screen's shell: its place under Profile (the profile
 * tab at `/profile`) and one readable column for the body.
 */
export function PrivacyScreenLayout(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <ContentScreen
      screenId="account-privacy"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Account privacy</Trans> },
      ]}
    >
      {props.children}
    </ContentScreen>
  );
}
