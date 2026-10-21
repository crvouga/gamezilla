/**
 * Opening checkout or the portal: why a refusal happened, read from the
 * answer's status, and what pressing subscribe leaves behind when it fails.
 */
import { describe, expect, mock, test } from 'bun:test';
import {
  BillingRequestError,
  billingFailureIn,
  billingFailureOf,
  providerUrlFrom,
} from '@libs/billing-client/billing-request-error';
import { openCheckout } from '@libs/billing-client/open-checkout';

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function failureOf(res: Response): Promise<string | null> {
  try {
    await providerUrlFrom(res, 'checkout');
    return null;
  } catch (error) {
    return billingFailureIn(error);
  }
}

describe('billing request failures', () => {
  // regression: billing-checkout-failure-generic-copy
  test('each answer reads as what the person is told', async () => {
    expect(
      await failureOf(
        answer(409, { error: 'This account already has a membership' })
      )
    ).toBe('has_membership');
    expect(await failureOf(answer(503, { code: 'provider_unavailable' }))).toBe(
      'provider_unavailable'
    );
    expect(
      await failureOf(answer(502, { error: 'Billing checkout URL missing' }))
    ).toBe('provider_unavailable');
    expect(await failureOf(answer(500, {}))).toBe('provider_unavailable');
    expect(await failureOf(answer(401, {}))).toBe('failed');
    expect(await failureOf(answer(200, { url: '' }))).toBe('failed');
    expect(await failureOf(answer(200, { url: 'https://pay.example' }))).toBe(
      null
    );
  });

  test('statuses map by range', () => {
    expect(billingFailureOf(409)).toBe('has_membership');
    expect(billingFailureOf(599)).toBe('provider_unavailable');
    expect(billingFailureOf(404)).toBe('failed');
    expect(billingFailureIn(new Error('other'))).toBeNull();
  });
});

describe('pressing subscribe', () => {
  // regression: billing-checkout-failure-keeps-awaiting-flag
  test('a checkout that never opened is no longer under way', async () => {
    const awaiting: boolean[] = [];
    const refresh = mock(() => undefined);
    const failure = new BillingRequestError(
      'provider_unavailable',
      'billing checkout failed (503)'
    );
    await expect(
      openCheckout({
        setAwaiting: (value) => awaiting.push(value),
        start: () => Promise.reject(failure),
        open: () => Promise.resolve(),
        refresh,
      })
    ).rejects.toBe(failure);
    expect(awaiting).toEqual([true, false]);
    expect(refresh).not.toHaveBeenCalled();
  });

  test('an account that already has a membership looks for it', async () => {
    const refresh = mock(() => undefined);
    await expect(
      openCheckout({
        setAwaiting: () => undefined,
        start: () =>
          Promise.reject(
            new BillingRequestError('has_membership', 'billing checkout (409)')
          ),
        open: () => Promise.resolve(),
        refresh,
      })
    ).rejects.toBeInstanceOf(BillingRequestError);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('an opened checkout stays under way', async () => {
    const awaiting: boolean[] = [];
    const open = mock((_url: string) => Promise.resolve());
    await openCheckout({
      setAwaiting: (value) => awaiting.push(value),
      start: () => Promise.resolve('https://pay.example/c'),
      open,
      refresh: () => undefined,
    });
    expect(awaiting).toEqual([true]);
    expect(open).toHaveBeenCalledWith('https://pay.example/c');
  });
});
