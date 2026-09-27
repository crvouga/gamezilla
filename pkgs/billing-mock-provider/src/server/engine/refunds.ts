/**
 * Refunds: a paid invoice's charge goes back to the customer in full. What
 * that means for the subscription is the merchant's call, as on Stripe — a
 * refund alone leaves it as it is.
 */
import type { MockInvoice, MockRefund } from '@pkgs/billing-mock/wire';

import { invalidRequest } from '../errors';
import { customerNowS, type Engine, emit, mint } from './context';
import { requireInvoice } from './invoices';

export async function refundInvoice(
  engine: Engine,
  invoiceId: string
): Promise<MockRefund> {
  const invoice = await requireInvoice(engine, invoiceId);
  if (invoice.status !== 'paid' || invoice.amount_paid === 0) {
    throw invalidRequest(
      `Invoice ${invoiceId} has no payment to refund.`,
      'invoice'
    );
  }
  if (invoice.amount_refunded >= invoice.amount_paid) {
    throw invalidRequest(
      `Invoice ${invoiceId} has already been refunded.`,
      'invoice'
    );
  }
  const nowS = await customerNowS(engine, invoice.customer);
  const refunded: MockInvoice = {
    ...invoice,
    amount_refunded: invoice.amount_paid,
  };
  await engine.db.put(refunded, invoice.customer);
  const refund: MockRefund = {
    id: mint(engine, 're'),
    object: 'refund',
    amount: invoice.amount_paid - invoice.amount_refunded,
    currency: invoice.currency,
    customer: invoice.customer,
    invoice: invoice.id,
    subscription: invoice.subscription,
    status: 'succeeded',
    created: nowS,
  };
  await engine.db.put(refund, invoice.customer);
  await emit(engine, {
    type: 'charge.refunded',
    object: refund,
    createdS: nowS,
  });
  return refund;
}
