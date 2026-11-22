import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseConfig } from '@libs/infra-shared-ts/hcl-parse';

// regression: pubsub-dns-comment-tug-of-war
// The zone's DNS inventory (crvouga/personal) declares the broker and
// certificate-validation records too, without a comment. A comment here made
// each repository's apply overwrite the other's, so every Release and Health
// run found the records drifted.
test('the broker DNS records declare nothing the zone inventory does not', () => {
  const source = readFileSync(
    join(import.meta.dirname, '../tofu/modules/pubsub/main.tf'),
    'utf8'
  );
  const records = parseConfig(source).blocks.filter(
    (block) =>
      block.type === 'resource' && block.labels[0] === 'cloudflare_dns_record'
  );
  expect(records.map((block) => block.labels[1])).toEqual([
    'cert_validation',
    'broker',
  ]);
  for (const record of records)
    expect([...record.body.attributes.keys()]).not.toContain('comment');
});
