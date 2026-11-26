import { capabilityKey } from '@libs/permissions-shared-ts/capabilities';
import { permissionPolicyForAdmins } from '@libs/permissions-shared-ts/permission-policy';
import { bindDecisions } from '@pkgs/dmn-shared-ts/registry';
import { decide } from '@pkgs/permissions-shared-ts/decision';
import { policyAt } from '@pkgs/permissions-shared-ts/policy';
import { resolveSubject } from '@pkgs/permissions-shared-ts/resolve';

const ACCOUNT_ID = '00000000-0000-4000-8000-000000000123';
bindDecisions({
  spec: 'observatory-access',
  layers: {
    'application decision': {
      decide(input) {
        const policy = policyAt(
          permissionPolicyForAdmins(
            input['authorized for this capability'] === 'yes'
              ? [ACCOUNT_ID]
              : []
          ),
          0
        );
        const subject = resolveSubject(
          policy,
          { auth: 'verified', accountId: ACCOUNT_ID },
          []
        );
        const decision = decide(
          policy,
          subject,
          capabilityKey(String(input['what they want to do']))
        );
        return {
          answer: decision.allowed ? 'yes' : 'no',
          reason: decision.allowed ? 'none' : 'permission required',
        };
      },
    },
  },
});
