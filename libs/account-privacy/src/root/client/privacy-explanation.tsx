import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

export function PrivacyExplanation(): JSX.Element {
  return <div class="box gap-3" data-testid="privacy-consequences">
    <p class="text"><Trans>Account deletion is permanent. Every device will be signed out, including offline devices when they reconnect. Signing in later starts a new account.</Trans></p>
    <p class="text"><Trans>You can take a personal-data export before deleting the account. Your profile, friends, progress and preferences will be erased within 30 days.</Trans></p>
    <p class="text"><Trans>Hosted spaces will end. Future membership charges will stop. If the payment provider has not confirmed cancellation yet, we will say so. Any membership payment taken after confirmed deletion will be refunded in full.</Trans></p>
    <div class="box gap-2" data-testid="privacy-retention">
      <p class="text"><Trans>We retain only minimum payment evidence for accounting and disputes for 7 years after payment. It cannot restore your account or membership.</Trans></p>
      <p class="text"><Trans>A specific legal preservation obligation may retain only the information it covers until that obligation ends. Preserved information cannot restore a profile or be used to promote the product. Any applicable obligation and its end condition will be disclosed here.</Trans></p>
      <p class="text"><Trans>There is no legal preservation obligation on this account unless one is listed below.</Trans></p>
    </div>
  </div>;
}
