import assert from 'node:assert/strict';
import { BaseCiCommand } from './base-command';
import { cloudFormation } from './aws';
import {
  DEPLOYABLE_STATUSES,
  STACK_NAME,
  describeStack,
  reasonIsSet,
} from './cfn-shared';
import { ghError, ghNotice } from './gh';

export class PreCdkCommand extends BaseCiCommand {
  readonly id = 'pre-cdk';
  readonly summary = 'Re-check stack deployable before CDK';

  async execute(argv: string[]): Promise<void> {
    assert(Array.isArray(argv));
    const client = cloudFormation();
    assert(client !== undefined && client !== null);
    const d = await describeStack(client);
    if (d === null) {
      ghNotice('ASSERT ok: stack absent — CDK create path.');
      return;
    }
    const { status, reason } = d;
    if (status === undefined || !DEPLOYABLE_STATUSES.has(status)) {
      ghError(
        `ASSERT failed: pre-CDK ${STACK_NAME} status=${status ?? 'undefined'} (expected stable deployable state).`
      );
      process.exit(1);
    }
    if (reasonIsSet(reason)) {
      ghError(`ASSERT failed: StackStatusReason=${reason}`);
      process.exit(1);
    }
    assert(DEPLOYABLE_STATUSES.has(status));
    assert(!reasonIsSet(reason));
    ghNotice(`ASSERT ok: pre-CDK status=${status}`);
  }
}
