import type { MembershipRow } from '@libs/billing-shared-ts/membership-row';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared-ts/plus-membership-offer';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { BillingRequestError } from './billing-request-error';
import { BillingScreenView } from './billing-screen-view';
import type { BillingView, BillingViewInput } from './billing-view-model';
import { buildBillingView } from './billing-view-model';
import { CancellationFeedbackExample } from './cancellation-feedback.example';

const NOW = Date.parse('2026-11-02T12:00:00.000Z');
const DAY = 86_400_000;
const PERIOD_END = '2026-11-12T12:00:00.000Z';
const PAST_END = '2026-10-30T12:00:00.000Z';

/** A signed-in account with billing on, no membership and no customer yet. */
const ACCOUNT: BillingViewInput = {
  canView: true,
  canSubscribe: true,
  canManage: true,
  subscribeUnlockLabel: null,
  hasCustomer: false,
  row: null,
  nowMs: NOW,
  graceMs: 0,
  confirmedAtMs: NOW,
  online: true,
  loading: false,
  checkoutReturnedAtMs: null,
};

/** The screen the real view model builds for `patch` over `ACCOUNT`. */
function view(patch: Partial<BillingViewInput>): BillingView {
  return buildBillingView({ ...ACCOUNT, ...patch });
}

/** A member with a customer: the portal is open to them. */
function member(
  status: string,
  patch: Partial<MembershipRow> = {}
): BillingView {
  return view({
    hasCustomer: true,
    row: {
      status,
      price_key: 'subscription_monthly',
      current_period_end: PERIOD_END,
      cancel_at_period_end: 0,
      ...patch,
    },
  });
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const meta = {
  id: 'screens-billing',
  title: 'Screens/Billing/Billing',
  component: BillingScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['view', 'offer', 'formatDate', 'actions'] },
  },
  args: {
    view: view({}),
    offer: PLUS_MEMBERSHIP_OFFER,
    locale: 'en-US',
    formatDate: (ms: number) => DATE_FORMAT.format(new Date(ms)),
    actions: {
      subscribe: fn(async () => undefined),
      manage: fn(async () => undefined),
      unlock: fn(),
      checkAgain: fn(),
    },
  },
} satisfies Meta<typeof BillingScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No membership yet: the free plan, the trial offer, prices and benefits. */
export const FreePlan: Story = {};

/** The membership row has not loaded: no plan is named and nothing is offered. */
export const Loading: Story = {
  args: { view: view({ loading: true }) },
};

/** Checkout happens at the provider, so offline says so before the press. */
export const Offline: Story = {
  args: { view: view({ online: false }) },
};

/** Subscribing is denied with a way forward: its unlock replaces checkout. */
export const SignInToSubscribe: Story = {
  args: {
    view: view({
      canSubscribe: false,
      canManage: false,
      subscribeUnlockLabel: 'Sign in',
    }),
  },
};

/** Billing is switched off: no offer, no pricing, just the notice. */
export const Unavailable: Story = {
  args: { view: view({ canView: false, canSubscribe: false }) },
};

/** A checkout was started but never finished; it can be completed. */
export const CheckoutIncomplete: Story = {
  args: { view: member('incomplete') },
};

/** Back from paying: the membership has not shown yet, so nothing is offered. */
export const ConfirmingPayment: Story = {
  args: { view: view({ checkoutReturnedAtMs: NOW - 30_000 }) },
};

/** Still nothing long after paying: check again before paying twice. */
export const PaymentUnconfirmed: Story = {
  args: { view: view({ checkoutReturnedAtMs: NOW - 10 * 60_000 }) },
};

/** On a free trial: the days left and its end date. */
export const Trialing: Story = { args: { view: member('trialing') } };

/** A paying member: renewal date, current plan marked, portal to manage it. */
export const Active: Story = { args: { view: member('active') } };

/** Yearly credit left over from a plan change shows above the actions. */
export const ActiveWithCredit: Story = {
  args: {
    view: member('active', {
      price_key: 'subscription_yearly',
      credit_cents: 1250,
    }),
  },
};

/** Canceled but still paid up: when it ends and when Plus access ends. */
export const Canceling: Story = {
  render: (args) => (
    <BillingScreenView
      {...args}
      cancellationFeedback={<CancellationFeedbackExample />}
    />
  ),
  args: {
    view: buildBillingView({
      ...ACCOUNT,
      hasCustomer: true,
      graceMs: 3 * DAY,
      row: {
        status: 'active',
        price_key: 'subscription_monthly',
        current_period_end: PERIOD_END,
        cancel_at_period_end: 1,
      },
    }),
  },
};

/** The optional answer is saved on this device while its connection is away. */
export const CancellationFeedbackOffline: Story = {
  args: { ...Canceling.args },
  render: (args) => (
    <BillingScreenView
      {...args}
      cancellationFeedback={
        <CancellationFeedbackExample
          online={false}
          saved={{ reason: 'low usage', comment: 'Less time to play.' }}
        />
      }
    />
  ),
};

/** A failed save retains the answer and offers a retry after cancellation. */
export const CancellationFeedbackFailure: Story = {
  args: { ...Canceling.args },
  render: (args) => (
    <BillingScreenView
      {...args}
      cancellationFeedback={<CancellationFeedbackExample fail />}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      await canvas.findByTestId('billing-feedback-comment'),
      'Taking a break from games.'
    );
    await userEvent.click(await canvas.findByTestId('billing-feedback-save'));
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Your answer is still here'
    );
    await expect(
      await canvas.findByTestId('billing-feedback-comment')
    ).toHaveValue('Taking a break from games.');
  },
};

/** The last payment failed: an error notice and update-payment as primary. */
export const PaymentFailed: Story = { args: { view: member('delinquent') } };

/** The membership ended: it can be started again at once. */
export const Ended: Story = {
  args: { view: member('ended', { current_period_end: PAST_END }) },
};

/** The provider cannot be reached: the failure says nothing was charged. */
export const CheckoutProviderUnavailable: Story = {
  args: {
    actions: {
      subscribe: fn(async () => {
        throw new BillingRequestError(
          'provider_unavailable',
          'billing checkout failed (503)'
        );
      }),
      manage: fn(async () => undefined),
      unlock: fn(),
      checkAgain: fn(),
    },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId(Handles.billingSubscribe));
    await expect(args.actions.subscribe).toHaveBeenCalled();
    await expect(
      await canvas.findByTestId(Handles.billingActionFailure)
    ).toBeVisible();
  },
};
