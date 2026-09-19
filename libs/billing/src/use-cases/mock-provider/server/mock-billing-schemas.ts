/**
 * Request validation for the mock billing API. Server-only so the SPA bundle
 * carries the contract's types, not zod. The route handlers take the
 * contract's body types, so a drifting schema fails to compile there.
 */
import { z } from 'zod';

export const mockCheckoutBodySchema = z.object({
  accountId: z.string().min(1),
  priceKey: z.string().min(1),
});

const mockPortalActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cancel') }),
  z.object({ kind: z.literal('resume') }),
  z.object({ kind: z.literal('switch'), priceKey: z.string().min(1) }),
]);

export const mockPortalBodySchema = z.object({
  accountId: z.string().min(1),
  action: mockPortalActionSchema,
});
