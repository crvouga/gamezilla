import { expect, test } from 'bun:test';
import type { RefundAdjustment } from '@pkgs/billing-paddle-shared/refund-plan';
import { planPaddleRefund } from '@pkgs/billing-paddle-shared/refund-plan';

const ITEMS = [
  { id: 'txnitm_membership', totals: { total: '700' } },
  { id: 'txnitm_second', totals: { total: '300' } },
];
const PARTIAL: RefundAdjustment = {
  action: 'refund',
  status: 'approved',
  items: [{ item_id: 'txnitm_membership', totals: { total: '200' } }],
};

test('an approved partial refund leaves the unpaid balance to return', () => {
  // regression: paddle-partial-refund-blocks-settlement
  expect(planPaddleRefund([PARTIAL], ITEMS)).toEqual({
    type: 'partial',
    tax_mode: 'internal',
    items: [
      { item_id: 'txnitm_membership', type: 'partial', amount: '500' },
      { item_id: 'txnitm_second', type: 'partial', amount: '300' },
    ],
  });
});

test('a pending approval waits; a rejected refund can be attempted again', () => {
  expect(
    planPaddleRefund([{ ...PARTIAL, status: 'pending_approval' }], ITEMS)
  ).toBeNull();
  expect(planPaddleRefund([{ ...PARTIAL, status: 'rejected' }], ITEMS)).toEqual(
    { type: 'full' }
  );
  expect(planPaddleRefund([], ITEMS)).toEqual({ type: 'full' });
});

test('several approved refunds settle each item without another charge', () => {
  const rest = {
    ...PARTIAL,
    items: [
      { item_id: 'txnitm_membership', totals: { total: '500' } },
      { item_id: 'txnitm_second', totals: { total: '300' } },
    ],
  };
  expect(planPaddleRefund([PARTIAL, rest], ITEMS)).toBeNull();
});
