/**
 * Customers, their payment methods, and what a charge against them does.
 *
 * Payment methods are attached from Stripe's magic test ids; each card's
 * behaviour is fixed by which one it came from, exactly as in test mode.
 */
import {
  MOCK_TEST_PAYMENT_METHODS,
  type MockCard,
  type MockCustomer,
  type MockPaymentMethod,
  type MockTestPaymentMethod,
} from '@pkgs/billing-mock/wire';

import { cardDeclined, invalidRequest, resourceMissing } from '../errors';
import { customerNowS, type Engine, emit, mint } from './context';

type CardBehaviour = 'succeeds' | 'fails_charges' | 'declined';

type TestCard = { readonly card: MockCard; readonly behaviour: CardBehaviour };

const TEST_CARDS: Readonly<Record<MockTestPaymentMethod, TestCard>> = {
  [MOCK_TEST_PAYMENT_METHODS.visa]: {
    card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2034 },
    behaviour: 'succeeds',
  },
  [MOCK_TEST_PAYMENT_METHODS.mastercard]: {
    card: { brand: 'mastercard', last4: '4444', exp_month: 12, exp_year: 2034 },
    behaviour: 'succeeds',
  },
  [MOCK_TEST_PAYMENT_METHODS.chargeCustomerFail]: {
    card: { brand: 'visa', last4: '0341', exp_month: 12, exp_year: 2034 },
    behaviour: 'fails_charges',
  },
  [MOCK_TEST_PAYMENT_METHODS.chargeDeclined]: {
    card: { brand: 'visa', last4: '0002', exp_month: 12, exp_year: 2034 },
    behaviour: 'declined',
  },
};

function isTestPaymentMethod(value: string): value is MockTestPaymentMethod {
  return Object.hasOwn(TEST_CARDS, value);
}

function behaviourOf(card: MockCard): CardBehaviour {
  const match = Object.values(TEST_CARDS).find(
    (candidate) => candidate.card.last4 === card.last4
  );
  return match?.behaviour ?? 'succeeds';
}

export async function requireCustomer(
  engine: Engine,
  id: string
): Promise<MockCustomer> {
  const customer = await engine.db.get<MockCustomer>(id, 'customer');
  if (customer === null) throw resourceMissing('customer', id);
  // The test clock is derived, so a stored copy never goes stale.
  return {
    ...customer,
    test_clock_frozen_time: await customerNowS(engine, id),
  };
}

export async function createCustomer(
  engine: Engine,
  body: {
    readonly email?: string;
    readonly name?: string;
    readonly metadata?: Readonly<Record<string, string>>;
  }
): Promise<MockCustomer> {
  const id = mint(engine, 'cus');
  const nowS = Math.floor(engine.deps.clock.now() / 1000);
  const customer: MockCustomer = {
    id,
    object: 'customer',
    created: nowS,
    email: body.email ?? null,
    name: body.name ?? null,
    metadata: body.metadata ?? {},
    invoice_settings: { default_payment_method: null },
    test_clock_frozen_time: nowS,
  };
  await engine.db.put(customer, id);
  await emit(engine, {
    type: 'customer.created',
    object: customer,
    createdS: nowS,
  });
  return customer;
}

/**
 * Attaches a card from a magic test id and makes it the default. A card that
 * declines outright fails here, as Checkout's card validation would.
 */
export async function attachDefaultPaymentMethod(
  engine: Engine,
  customerId: string,
  paymentMethod: string
): Promise<MockPaymentMethod> {
  const customer = await requireCustomer(engine, customerId);
  if (!isTestPaymentMethod(paymentMethod)) {
    throw invalidRequest(
      `No such PaymentMethod: '${paymentMethod}'. Use a test payment method such as pm_card_visa.`,
      'payment_method'
    );
  }
  const test = TEST_CARDS[paymentMethod];
  if (test.behaviour === 'declined') throw cardDeclined();
  const nowS = await customerNowS(engine, customerId);
  const method: MockPaymentMethod = {
    id: mint(engine, 'pm'),
    object: 'payment_method',
    type: 'card',
    customer: customerId,
    card: test.card,
    created: nowS,
  };
  await engine.db.put(method, customerId);
  await engine.db.put(
    {
      ...customer,
      invoice_settings: { default_payment_method: method.id },
    },
    customerId
  );
  return method;
}

export async function defaultPaymentMethod(
  engine: Engine,
  customerId: string
): Promise<MockPaymentMethod | null> {
  const customer = await requireCustomer(engine, customerId);
  const id = customer.invoice_settings.default_payment_method;
  return id === null
    ? null
    : await engine.db.get<MockPaymentMethod>(id, 'payment_method');
}

/** Whether charging the customer's default card succeeds right now. */
export async function chargeSucceeds(
  engine: Engine,
  customerId: string
): Promise<boolean> {
  const method = await defaultPaymentMethod(engine, customerId);
  return method !== null && behaviourOf(method.card) === 'succeeds';
}
