import { useCurrentUser } from '@libs/auth/public/use-current-user';
import { PERMISSION, ROLE } from '@libs/permissions/public/permission-catalog';
import { useCan } from '@libs/permissions/public/use-can';
import { usePlanRole } from '@libs/permissions/public/use-plan-role';
import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import {
  Button,
  ScreenBase,
  useMutationButton,
  useOpenExternalUrl,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { useManageSubscription } from '../../use-cases/open-portal-session/client/use-manage-subscription';
import { useSubscribe } from './use-subscribe';

/** Display label per plan role; the role itself is a policy value. */
const PLAN_LABEL: Record<string, string> = {
  [ROLE.planGuest]: 'guest',
  [ROLE.planFree]: 'free',
  [ROLE.planPaid]: 'paid',
};

/** Account billing: current plan, subscribe, and manage the subscription. */
export function BillingScreen(): JSX.Element {
  const { t } = useLingui();
  const planRole = usePlanRole();
  const canSubscribe = useCan(PERMISSION.billingSubscribe);
  const canManage = useCan(PERMISSION.billingManage);
  const currentUser = useCurrentUser();
  const subscribe = useSubscribe();
  const manage = useManageSubscription();
  const openExternalUrl = useOpenExternalUrl();

  const openCheckout = async (): Promise<void> => {
    const url = await subscribe({
      returnUrl: `${window.location.origin}/more/billing`,
    });
    await openExternalUrl(url);
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

  const manageButton = useMutationButton({
    operation: manage,
    labels: {
      idle: t`Manage subscription`,
      loading: t`Opening…`,
      success: t`Opening…`,
      error: t`Couldn't open billing`,
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
        <div class="box gap-4 p-4" data-testid={Handles.billingScreen}>
          <p class="text textBodyBold">
            <Trans>Plan</Trans>
          </p>
          <p class="text textBody" data-testid={Handles.billingTier}>
            {PLAN_LABEL[planRole()] ?? planRole()}
          </p>
          <Show when={!canManage()}>
            <p class="text textCaption text-secondary">
              <Trans>Sign in to subscribe and keep your progress.</Trans>
            </p>
          </Show>
          <Show when={canSubscribe()}>
            <Button
              {...checkout.buttonProps}
              dataSet={{ testid: Handles.billingSubscribe }}
            />
          </Show>
          <Show when={canManage() && currentUser.billingCustomerId !== null}>
            <Button
              {...manageButton.buttonProps}
              intent="neutral"
              variant="outline"
              dataSet={{ testid: Handles.billingManage }}
            />
          </Show>
        </div>
      )}
    />
  );
}
