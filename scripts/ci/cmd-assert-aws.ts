import assert from 'node:assert/strict';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { BaseCiCommand } from './base-command';
import { requireAwsRegion } from './aws';
import { ghError, ghNotice } from './gh';

export class AssertAwsCommand extends BaseCiCommand {
  readonly id = 'assert-aws';
  readonly summary = 'STS GetCallerIdentity + assertions';

  async execute(argv: string[]): Promise<void> {
    assert(Array.isArray(argv));
    const region = requireAwsRegion();
    assert(region.length > 0);
    const sts = new STSClient({ region });
    const id = await sts.send(new GetCallerIdentityCommand({}));
    assert(id !== undefined && id !== null && typeof id === 'object');
    console.log(
      JSON.stringify(
        {
          Account: id.Account,
          Arn: id.Arn,
          UserId: id.UserId,
        },
        null,
        2
      )
    );
    if (id.Account === undefined || id.Account === '') {
      ghError('STS Account missing');
      assert.fail('assert-aws: STS Account must be present');
    }
    if (id.Arn === undefined || id.Arn === '') {
      ghError('STS Arn missing');
      assert.fail('assert-aws: STS Arn must be present');
    }
    assert(id.Account.length > 0);
    assert(id.Arn.length > 0);
    ghNotice(
      `ASSERT ok: caller ${id.Arn} account=${id.Account} region=${process.env['AWS_REGION']}`
    );
  }
}
