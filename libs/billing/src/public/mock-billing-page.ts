/**
 * The mock provider's hosted pages as a component, for a browser host that
 * loads the session link itself (the sim's per-actor browser), plus the
 * stylesheet the SPA ships with.
 */
export {
  MockBillingSessionPage,
  type MockBillingSessionPageProps,
} from '../use-cases/mock-provider/client/session-page';
export { MOCK_BILLING_SPA_CSS } from '../use-cases/mock-provider/server/mock-billing-assets.generated';
