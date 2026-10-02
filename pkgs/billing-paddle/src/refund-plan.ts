/** Paddle's tax-inclusive adjustment totals, in currency minor units. */
export type RefundAdjustment = {
  readonly action: string;
  readonly status: string;
  readonly items: readonly {
    readonly item_id: string;
    readonly totals: { readonly total: string };
  }[];
};

export type RefundLineItem = {
  readonly id: string;
  readonly totals: { readonly total: string };
};

export type RefundPlan =
  | { readonly type: 'full' }
  | {
      readonly type: 'partial';
      readonly tax_mode: 'internal';
      readonly items: readonly {
        readonly item_id: string;
        readonly type: 'partial';
        readonly amount: string;
      }[];
    };

/** A pending refund must settle before another adjustment can be made. */
export function planPaddleRefund(
  adjustments: readonly RefundAdjustment[],
  lineItems: readonly RefundLineItem[]
): RefundPlan | null {
  const refunds = adjustments.filter((entry) => entry.action === 'refund');
  if (refunds.some((entry) => entry.status === 'pending_approval')) return null;
  const approved = refunds.filter((entry) => entry.status === 'approved');
  if (approved.length === 0) return { type: 'full' };
  const items = lineItems.flatMap((item) => {
    const returned = approved
      .flatMap((entry) => entry.items)
      .filter((entry) => entry.item_id === item.id)
      .reduce((sum, entry) => sum + minorAmount(entry.totals.total), 0);
    const remaining = minorAmount(item.totals.total) - returned;
    return remaining <= 0
      ? []
      : [
          {
            item_id: item.id,
            type: 'partial' as const,
            amount: String(remaining),
          },
        ];
  });
  return items.length === 0
    ? null
    : { type: 'partial', tax_mode: 'internal', items };
}

function minorAmount(value: string): number {
  const amount = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(amount))
    throw new Error('paddle: unreadable adjustment amount');
  return amount;
}
