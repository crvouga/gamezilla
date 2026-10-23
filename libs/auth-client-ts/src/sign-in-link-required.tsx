/**
 * "Connect your accounts": a sign-in's address matched an existing account,
 * but not with both providers vouching for it. The person either proves the
 * existing account (signing in with one of its methods attaches the new one)
 * or keeps the new sign-in as a separate account. Nothing is linked for them.
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { AuthLinkRequiredError } from '@pkgs/auth-root-client-ts/auth-link-required-error';
import type { OauthProviderId } from '@pkgs/auth-root-shared-ts/sign-in-method';
import { isOauthProviderId } from '@pkgs/auth-root-shared-ts/sign-in-method';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import {
  ModalBody,
  ModalButton,
  ModalFooter,
} from '@pkgs/ui-root-client-ts/modal-parts';
import { SocialSignInButton } from '@pkgs/ui-root-client-ts/social-sign-in-button';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX, Show } from 'solid-js';
import { providerName } from './auth-flow-messages';
import { ContinueWithEmailButton } from './continue-with-email-button';

export function SignInLinkRequiredContent(props: {
  readonly link: AuthLinkRequiredError;
  readonly onProve: (provider: OauthProviderId) => void;
  readonly onSeparate: () => void;
  readonly onClose: () => void;
  readonly onContinueWithEmail: () => void;
}): JSX.Element {
  const { i18n, t } = useLingui();
  const newProvider = () => providerName(i18n(), props.link.provider);
  return (
    <>
      <ModalBody>
        <StackVertical gap="md" testId={Handles.authLinkRequired}>
          <H2 size="label">
            <Trans>Connect your accounts?</Trans>
          </H2>
          <P tone="secondary">
            {t`An account already uses ${props.link.email}. Sign in to it to add ${newProvider()} as another way to sign in, or keep a separate account.`}
          </P>
          <Show when={props.link.providers.includes('email')}>
            <ContinueWithEmailButton onClick={props.onContinueWithEmail} />
          </Show>
          <For each={props.link.providers.filter(isOauthProviderId)}>
            {(provider) => (
              <SocialSignInButton
                provider={provider}
                action="continue"
                theme={provider === 'apple' ? 'dark' : 'light'}
                onClick={() => props.onProve(provider)}
                dataSet={{ testid: Handles.authLinkWith(provider) }}
              />
            )}
          </For>
          <Button
            title={t`Keep a separate account`}
            variant="ghost"
            intent="neutral"
            onClick={() => props.onSeparate()}
            dataSet={{ testid: Handles.authLinkSeparate }}
          />
        </StackVertical>
      </ModalBody>
      <ModalFooter>
        <ModalButton
          label={t`Cancel`}
          variant="cancel"
          onClick={props.onClose}
        />
      </ModalFooter>
    </>
  );
}
