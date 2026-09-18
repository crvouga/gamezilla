import { useIsSignedIn } from '@libs/auth/public/use-current-user';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button, ScreenBase, useMutationButton } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { useTier } from './use-entitlement';
import { useSubscribe } from './use-subscribe';

const PRICE_KEY_MONTHLY = 'subscription_monthly';

function billingReturnUrl(): string {
  return `${window.location.origin}/more/billing`;
}

/** Account billing: current plan and the subscribe action. */
export function BillingScreen(): JSX.Element {
  const { t } = useLingui();
  const tier = useTier();
  const signedIn = useIsSignedIn();
  const subscribe = useSubscribe();

  const openCheckout = async (): Promise<void> => {
    const url = await subscribe({
      priceKey: PRICE_KEY_MONTHLY,
      successUrl: billingReturnUrl(),
      cancelUrl: billingReturnUrl(),
    });
    window.location.assign(url);
  };

  const checkout = useMutationButton({
    operation: openCheckout,
    labels: {
      idle: t`Subscribe`,
      loading: t`Opening…`,
      success: t`Opening…`,
      error: t`Couldn't open checkout`,
    },
    get disabled() {
      return !signedIn();
    },
  });

  return (
    <ScreenBase
      screenId="billing"
      surface="canvas"
      breadcrumbs={[
        { name: <Trans>More</Trans>, href: '/more' },
        { name: <Trans>Billing</Trans> },
      ]}
      content={() => (
        <div class="box gap-4 p-4" data-testid="billing-screen">
          <p class="text textBodyBold">
            <Trans>Plan</Trans>
          </p>
          <p class="text textBody" data-testid="billing-tier">
            {tier()}
          </p>
          <Show when={!signedIn()}>
            <p class="text textCaption text-secondary">
              <Trans>Sign in to subscribe and keep your progress.</Trans>
            </p>
          </Show>
          <Show when={signedIn() && tier() !== 'paid'}>
            <Button {...checkout.buttonProps} />
          </Show>
        </div>
      )}
    />
  );
}
