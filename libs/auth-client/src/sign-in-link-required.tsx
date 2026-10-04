/**
 * "Connect your accounts": a sign-in's address matched an existing account,
 * but not with both providers vouching for it. The person either proves the
 * existing account (signing in with one of its methods attaches the new one)
 * or keeps the new sign-in as a separate account. Nothing is linked for them.
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { AuthLinkRequiredError } from '@pkgs/auth-root-client/auth-link-required-error';
import type { OauthProviderId } from '@pkgs/auth-root-shared/sign-in-method';
import { Button } from '@pkgs/ui-root-client/button';
import {
  ModalBody,
  ModalButton,
  ModalFooter,
} from '@pkgs/ui-root-client/modal-parts';
import { SocialSignInButton } from '@pkgs/ui-root-client/social-sign-in-button';
import { For, type JSX } from 'solid-js';

import { providerName } from './auth-flow-messages';

export function SignInLinkRequiredContent(props: {
  readonly link: AuthLinkRequiredError;
  readonly onProve: (provider: OauthProviderId) => void;
  readonly onSeparate: () => void;
  readonly onClose: () => void;
}): JSX.Element {
  const { i18n, t } = useLingui();
  const newProvider = () => providerName(i18n(), props.link.provider);
  return (
    <>
      <ModalBody>
        <div class="box gap-3" data-testid={Handles.authLinkRequired}>
          <h2 class="text textBodyBold">
            <Trans>Connect your accounts?</Trans>
          </h2>
          <p class="text text-text-secondary">
            {t`An account already uses ${props.link.email}. Sign in to it to add ${newProvider()} as another way to sign in, or keep a separate account.`}
          </p>
          <For each={props.link.providers}>
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
        </div>
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
