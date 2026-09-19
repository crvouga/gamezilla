/**
 * The mock provider's hosted-page API client — the same one its SPA uses — so
 * a headless browser (the sim) drives the pages through the exact contract.
 */
export {
  createMockBillingApi,
  type MockBillingApi,
} from '../use-cases/mock-provider/client/api';
export type {
  MockBillingState,
  MockPortalAction,
} from '../use-cases/mock-provider/shared/mock-billing-contract';
