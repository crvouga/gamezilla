import { decidePrivacyAccess } from '@libs/permissions/public/privacy-permission';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions/root/access-model';
import { capabilityKey } from '@libs/permissions/root/conformance/capabilities';
import { CASE_NOW_MS, factsOf } from '@libs/permissions/root/conformance/people';
import { bindDecisions } from '@pkgs/dmn/registry';
import { decide, policyAt, resolveSubject } from '@pkgs/permissions';

const REASONS = { requires_account: 'needs an account', requires_connection: 'needs a connection', requires_recent_proof: 'prove the account again' } as const;

bindDecisions({
  spec: 'privacy-access',
  layers: {
    'application decision': {
      decide(input) {
        const policy = policyAt(DEFAULT_PERMISSION_POLICY, CASE_NOW_MS);
        const key = capabilityKey(String(input['what they want to do']));
        const account = decide(policy, resolveSubject(policy, factsOf(input, CASE_NOW_MS), []), key);
        const answer = decidePrivacyAccess(account, { connected: input['has a connection'] === 'yes', authenticatedAtMs: input['account proof is less than 10 minutes old'] === 'yes' ? CASE_NOW_MS : CASE_NOW_MS - 600_000, nowMs: CASE_NOW_MS });
        const reason = answer.reason;
        return { answer: answer.allowed ? 'yes' : 'no', reason: reason === undefined ? 'none' : REASONS[reason as keyof typeof REASONS] ?? reason };
      },
    },
  },
});
