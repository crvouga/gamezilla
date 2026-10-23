import { Trans } from '@lingui/solid/macro';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';

export function PrivacyExplanation(): JSX.Element {
  return (
    <StackVertical gap="md" testId="privacy-consequences">
      <P>
        <Trans>
          Account deletion is permanent. Every device will be signed out,
          including offline devices when they reconnect. Signing in later starts
          a new account.
        </Trans>
      </P>
      <P>
        <Trans>
          You can take a personal-data export before deleting the account. Your
          profile, friends, progress and preferences will be erased within 30
          days.
        </Trans>
      </P>
      <P>
        <Trans>
          Hosted spaces will end. If you have Plus, Plus ends at once: the
          remaining paid time and Plus credit are not refunded. Future
          membership charges will stop. If the payment provider has not
          confirmed cancellation yet, we will say so. Any membership payment
          taken after confirmed deletion will be refunded in full.
        </Trans>
      </P>
      <StackVertical gap="sm" testId="privacy-retention">
        <P tone="secondary">
          <Trans>
            We retain only minimum payment evidence for accounting and disputes
            for 7 years after payment. It cannot restore your account or
            membership.
          </Trans>
        </P>
        <P tone="secondary">
          <Trans>
            A specific legal preservation obligation may retain only the
            information it covers until that obligation ends. Preserved
            information cannot restore a profile or be used to promote the
            product. Any applicable obligation and its end condition will be
            disclosed here.
          </Trans>
        </P>
        <P tone="secondary">
          <Trans>
            There is no legal preservation obligation on this account unless one
            is listed below.
          </Trans>
        </P>
      </StackVertical>
    </StackVertical>
  );
}
