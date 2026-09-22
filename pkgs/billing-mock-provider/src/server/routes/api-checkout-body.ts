/** A checkout-session request body, JSON or form-encoded, as the engine takes it. */
import type {
  CreateCheckoutSessionBody,
  MockMissingPaymentMethodBehavior,
  MockTrialSettings,
} from '@pkgs/billing-mock/wire';

import { invalidRequest } from '../errors';
import {
  type Body,
  listField,
  optionalInteger,
  optionalString,
  recordField,
  stringField,
  stringRecord,
} from './request';

const MISSING_PAYMENT_METHOD: readonly MockMissingPaymentMethodBehavior[] = [
  'cancel',
  'pause',
  'create_invoice',
];

function trialSettingsOf(
  data: Body | undefined
): MockTrialSettings | undefined {
  const behavior = recordField(
    recordField(data ?? {}, 'trial_settings') ?? {},
    'end_behavior'
  );
  if (behavior === undefined) return undefined;
  const value = stringField(behavior, 'missing_payment_method');
  if (!(MISSING_PAYMENT_METHOD as readonly string[]).includes(value)) {
    throw invalidRequest(
      `Invalid missing_payment_method: ${value}`,
      'subscription_data[trial_settings][end_behavior][missing_payment_method]'
    );
  }
  return {
    end_behavior: {
      missing_payment_method: value as MockMissingPaymentMethodBehavior,
    },
  };
}

function priceOfLine(body: Body): string {
  const line = listField(body, 'line_items')[0];
  if (line === null || typeof line !== 'object') {
    throw invalidRequest(
      'Missing required param: line_items[0][price].',
      'line_items'
    );
  }
  const quantity = optionalInteger(line as Body, 'quantity') ?? 1;
  if (quantity !== 1) {
    throw invalidRequest('Quantity must be 1.', 'line_items[0][quantity]');
  }
  return stringField(line as Body, 'price');
}

function collectionOf(body: Body): 'always' | 'if_required' | undefined {
  const value = optionalString(body, 'payment_method_collection');
  if (value === undefined || value === 'always' || value === 'if_required') {
    return value;
  }
  throw invalidRequest(
    `Invalid payment_method_collection: ${value}`,
    'payment_method_collection'
  );
}

export function checkoutSessionBody(body: Body): CreateCheckoutSessionBody {
  if (body['mode'] !== 'subscription') {
    throw invalidRequest('Only `subscription` mode is supported.', 'mode');
  }
  const data = recordField(body, 'subscription_data');
  const trial =
    data === undefined ? undefined : optionalInteger(data, 'trial_period_days');
  const trialSettings = trialSettingsOf(data);
  const reference = optionalString(body, 'client_reference_id');
  const collection = collectionOf(body);
  return {
    mode: 'subscription',
    customer: stringField(body, 'customer'),
    ...(reference === undefined ? {} : { client_reference_id: reference }),
    ...(collection === undefined
      ? {}
      : { payment_method_collection: collection }),
    line_items: [{ price: priceOfLine(body), quantity: 1 }],
    success_url: stringField(body, 'success_url'),
    cancel_url: stringField(body, 'cancel_url'),
    subscription_data: {
      metadata: stringRecord(
        data === undefined ? undefined : recordField(data, 'metadata')
      ),
      ...(trial !== undefined && trial > 0 ? { trial_period_days: trial } : {}),
      ...(trialSettings === undefined ? {} : { trial_settings: trialSettings }),
    },
  };
}
