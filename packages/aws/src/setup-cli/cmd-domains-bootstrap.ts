import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert } from '@gamezilla/shared/assert';
import { PROJECT_CONFIG } from '../project-config';
import { BaseSetupCommand } from './base-command';
import { runCdkDeployCustomDomain } from './cdk-domain-deploy';
import { CUSTOM_HTTPS_HOSTS, SETUP_DNS_DOMAINS } from './dns-config';
import { AWS_PACKAGE_ROOT } from './shared';

export class DomainsBootstrapCommand extends BaseSetupCommand {
  readonly id = 'domains-bootstrap';
  readonly summary =
    'CDK deploy phase 1: hosted zones + NS outputs (TLS/aliases deferred)';

  execute(_argv: string[]): void {
    const region = PROJECT_CONFIG.aws.region;
    process.env['AWS_REGION'] = region;
    process.env['AWS_DEFAULT_REGION'] = region;

    console.log(
      'Deploying with customDomain=true, customDomainBootstrap=true …'
    );
    runCdkDeployCustomDomain(true);

    const path = join(AWS_PACKAGE_ROOT, 'cdk-outputs.json');
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
    assert.ok(
      typeof raw === 'object' &&
        raw !== null &&
        !Array.isArray(raw) &&
        PROJECT_CONFIG.stack.name in (raw as object),
      'cdk-outputs.json missing stack key'
    );
    const stack = (raw as Record<string, Record<string, string>>)[
      PROJECT_CONFIG.stack.name
    ];
    assert.defined(stack, 'stack outputs');

    console.log('\n--- Delegate these nameservers at your registrar ---\n');
    for (const { domain, outputKey } of SETUP_DNS_DOMAINS) {
      const ns = stack[outputKey];
      if (ns === undefined || ns === '') {
        console.log(`${domain}: (no ${outputKey} in outputs — is customDomain enabled?)`);
        continue;
      }
      console.log(`${domain}:`);
      console.log(`  ${outputKey}: ${ns}`);
      console.log(
        `  Add each NS record at your registrar for ${domain}, then run: bun run setup domains-finalize\n`
      );
    }

    console.log(
      'After delegation propagates, custom domains will work at e.g. ' +
        CUSTOM_HTTPS_HOSTS.join(', ')
    );
  }
}
