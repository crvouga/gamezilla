import { Handles } from '@libs/test-ids-shared/handles';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { MailIcon } from '@pkgs/ui-root-client/icons';
import { type JSX, Show } from 'solid-js';
import { useSignInCapabilities } from './sign-in-capabilities-context';

/**
 * Opens {@link EmailSignInSurface}; the form never shares a surface.
 *
 * Email sign-in exists for Synthetic Users only, so this renders nothing
 * unless the device's own capability turns it on. Every place that offers
 * email goes through this button: a person's app never shows one.
 */
export function ContinueWithEmailButton(props: {
  onClick: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const capabilities = useSignInCapabilities();
  return (
    <Show when={capabilities.email}>
      <Button
        title={t`Continue with email`}
        icon={MailIcon}
        intent="neutral"
        variant="outline"
        onClick={props.onClick}
        dataSet={{ testid: Handles.authMethodEmail }}
      />
    </Show>
  );
}
