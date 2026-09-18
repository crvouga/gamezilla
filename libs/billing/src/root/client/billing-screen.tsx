import { PERMISSION, ROLE } from '@libs/permissions/public/permission-catalog';
import { useCan } from '@libs/permissions/public/use-can';
import { usePlanRole } from '@libs/permissions/public/use-plan-role';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button, ScreenBase, useMutationButton } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { useSubscribe } from './use-subscribe';

const PRICE_KEY_MONTHLY = 'subscription_monthly';

/** Display label per plan role; the previous screen printed the raw tier. */
const PLAN_LABEL: Record<string, string> = {
  [ROLE.planGuest]: 'guest',
  [ROLE.planFree]: 'free',
  [ROLE.planPaid]: 'paid',
};

function billingReturnUrl(): string {
  return `${window.location.origin}/more/billing`;
}

/** Account billing: current plan and the subscribe action. */
export function BillingScreen(): JSX.Element {
  const { t } = useLingui();
  const planRole = usePlanRole();
  const canSubscribe = useCan(PERMISSION.billingSubscribe);
  const canManage = useCan(PERMISSION.billingManage);
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
      return !canSubscribe();
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
            {PLAN_LABEL[planRole()] ?? planRole()}
          </p>
          <Show when={!canManage()}>
            <p class="text textCaption text-secondary">
              <Trans>Sign in to subscribe and keep your progress.</Trans>
            </p>
          </Show>
          <Show when={canSubscribe()}>
            <Button {...checkout.buttonProps} />
          </Show>
        </div>
      )}
    />
  );
}
