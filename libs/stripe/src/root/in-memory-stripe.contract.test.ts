import { describe, expect, test } from 'bun:test';
import { createInMemoryStripe } from './in-memory-stripe';

describe('Stripe port contract — in-memory', () => {
  test('billing portal session has url', async () => {
    const stripe = createInMemoryStripe({ baseUrl: 'https://stripe.test' });
    const session = await stripe.billingPortal.sessions.create({
      customer: 'cus_1',
      return_url: 'https://app.test/return',
    });
    expect(session.url).toContain('https://stripe.test');
  });
});
