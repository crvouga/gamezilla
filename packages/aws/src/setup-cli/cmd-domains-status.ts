import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_CONFIG } from '../project-config';
import { BaseSetupCommand } from './base-command';
import { CUSTOM_HTTPS_HOSTS, SETUP_DNS_DOMAINS } from './dns-config';
import { parseNameservers } from './ns-parse';
import { statusRule, statusSym } from './status-symbols';
import { AWS_PACKAGE_ROOT, runLocalCapture } from './shared';

const ACM_REGION = 'us-east-1';

function hr(): void {
  console.log('');
}

function section(title: string): void {
  hr();
  console.log(`${'─'.repeat(3)} ${title} ${'─'.repeat(3)}`);
  hr();
}

export class DomainsStatusCommand extends BaseSetupCommand {
  readonly id = 'domains-status';
  readonly summary =
    'Route53 NS vs public DNS, ACM cert status, CloudFront aliases, HTTPS probes';

  execute(_argv: string[]): void {
    const region = PROJECT_CONFIG.aws.region;
    process.env['AWS_REGION'] = region;
    process.env['AWS_DEFAULT_REGION'] = region;

    const outputsPath = join(AWS_PACKAGE_ROOT, 'cdk-outputs.json');
    let stack: Record<string, string> | undefined;
    if (existsSync(outputsPath)) {
      try {
        const doc = JSON.parse(readFileSync(outputsPath, 'utf8')) as Record<
          string,
          Record<string, string>
        >;
        stack = doc[PROJECT_CONFIG.stack.name];
      } catch {
        console.log(
          statusRule(statusSym.warn, `Could not parse ${outputsPath}`)
        );
      }
    } else {
      console.log(
        statusRule(
          statusSym.warn,
          `No ${outputsPath}`,
          'some checks skipped — run deploy once to generate outputs'
        )
      );
    }

    let nsOk = 0;
    let nsFail = 0;
    let nsSkip = 0;

    section('NS delegation (Route53 stack vs public DNS)');

    for (const { domain, outputKey } of SETUP_DNS_DOMAINS) {
      const raw = stack?.[outputKey];
      if (raw !== undefined && raw !== '') {
        console.log(`${statusSym.bullet} ${domain} (${outputKey})`);
        console.log(`    Stack NS: ${raw}`);
        const expected = parseNameservers(raw);
        const dig = runLocalCapture('dig', ['NS', domain, '+short']);
        const actual =
          dig.ok && dig.stdout.trim().length > 0
            ? parseNameservers(dig.stdout)
            : new Set<string>();
        const match =
          expected.size > 0 &&
          actual.size > 0 &&
          [...expected].every((n) => actual.has(n)) &&
          [...actual].every((n) => expected.has(n));
        if (match) {
          console.log(
            `    ${statusRule(statusSym.ok, 'Public DNS matches stack — delegation looks correct')}`
          );
          nsOk++;
        } else {
          console.log(
            `    ${statusRule(statusSym.fail, 'Mismatch — update registrar nameservers to Stack NS above')}`
          );
          console.log(
            `    ${statusSym.bullet} Public NS: ${[...actual].join(', ') || '(empty / dig failed)'}`
          );
          nsFail++;
        }
      } else {
        console.log(
          statusRule(
            statusSym.skip,
            `${domain}`,
            `no ${outputKey} in outputs (custom domain not in this deploy?)`
          )
        );
        nsSkip++;
      }
      hr();
    }

    let acmLine = '';
    section(`ACM certificates (${ACM_REGION})`);

    const list = runLocalCapture(
      'aws',
      [
        'acm',
        'list-certificates',
        '--region',
        ACM_REGION,
        '--output',
        'json',
      ],
      { cwd: AWS_PACKAGE_ROOT }
    );
    let acmOk = false;
    if (list.ok) {
      try {
        const doc = JSON.parse(list.stdout) as {
          CertificateSummaryList?: {
            DomainName?: string;
            Status?: string;
          }[];
        };
        const rows = doc.CertificateSummaryList ?? [];
        const interesting = rows.filter(
          (c) =>
            typeof c.DomainName === 'string' &&
            (c.DomainName.includes('gamezilla') ||
              c.DomainName.includes('patchdb'))
        );
        if (interesting.length === 0) {
          console.log(
            statusRule(
              statusSym.warn,
              'No gamezilla / patchdb certs in ACM list',
              'normal until NS delegates and you run domains-finalize'
            )
          );
          acmLine = 'none listed';
        } else {
          acmOk = interesting.some((c) => c.Status === 'ISSUED');
          for (const c of interesting) {
            const st = c.Status ?? '?';
            const mark =
              st === 'ISSUED'
                ? statusSym.ok
                : st === 'PENDING_VALIDATION'
                  ? statusSym.warn
                  : statusSym.bullet;
            console.log(`    ${mark} ${c.DomainName ?? '?'}  (${st})`);
          }
          acmLine = `${interesting.length} cert(s) listed${acmOk ? ', ISSUED present' : ', none ISSUED yet'}`;
        }
      } catch {
        console.log(statusRule(statusSym.fail, 'Parse error', 'raw output below'));
        console.log(list.stdout.slice(0, 500));
        acmLine = 'parse error';
      }
    } else {
      console.log(
        statusRule(
          statusSym.fail,
          'aws acm list-certificates failed',
          list.stderr.trim()
        )
      );
      acmLine = 'error';
    }

    let cfAliasesOk = 0;
    let cfAliasesWarn = 0;

    section('CloudFront alternate domain names');

    const webId = stack?.WebDistributionId;
    for (const [label, id] of [
      ['WebApp', webId],
    ] as const) {
      if (id === undefined || id === '') {
        console.log(
          statusRule(statusSym.skip, label, 'no distribution id in outputs')
        );
        hr();
        continue;
      }
      const g = runLocalCapture(
        'aws',
        [
          'cloudfront',
          'get-distribution',
          '--id',
          id,
          '--query',
          'Distribution.DistributionConfig.{Aliases:Aliases,Enabled:Enabled}',
          '--output',
          'json',
        ],
        { cwd: AWS_PACKAGE_ROOT }
      );
      if (g.ok) {
        try {
          const cfg = JSON.parse(g.stdout) as {
            Aliases?: { Quantity?: number; Items?: string[] };
            Enabled?: boolean;
          };
          const q = cfg.Aliases?.Quantity ?? 0;
          const items = cfg.Aliases?.Items ?? [];
          const en = cfg.Enabled === true;
          if (q > 0 && items.length > 0) {
            console.log(
              `${statusSym.ok} ${label} (${id}) — ${q} alias(es): ${items.join(', ')}`
            );
            cfAliasesOk++;
          } else {
            console.log(
              `${statusSym.warn} ${label} (${id}) — no custom aliases yet (typical before domains-finalize)`
            );
            cfAliasesWarn++;
          }
          console.log(`    ${statusSym.bullet} Enabled: ${en}`);
        } catch {
          console.log(`${statusSym.bullet} ${label} (${id}): ${g.stdout.trim()}`);
        }
      } else {
        console.log(
          statusRule(
            statusSym.fail,
            `${label} get-distribution`,
            g.stderr.trim()
          )
        );
      }
      hr();
    }

    let httpsOk = 0;
    let httpsFail = 0;

    section('HTTPS (custom hostnames)');

    for (const url of CUSTOM_HTTPS_HOSTS) {
      const curl = runLocalCapture('curl', [
        '-sS',
        '-o',
        '/dev/null',
        '-w',
        '%{http_code}',
        '--max-time',
        '15',
        url,
      ]);
      if (curl.ok) {
        const code = curl.stdout.trim();
        const n = parseInt(code, 10);
        if (n >= 200 && n < 400) {
          console.log(statusRule(statusSym.ok, url, `HTTP ${code}`));
          httpsOk++;
        } else {
          console.log(
            statusRule(statusSym.warn, url, `HTTP ${code} (unexpected for probe)`)
          );
          httpsFail++;
        }
      } else {
        const err = curl.stderr.trim() || `exit ${curl.code}`;
        console.log(statusRule(statusSym.fail, url, err));
        httpsFail++;
      }
    }

    hr();
    console.log(`${'─'.repeat(3)} Summary ${'─'.repeat(3)}`);
    console.log(
      `  ${statusSym.ok} NS delegation ok: ${nsOk}   ${statusSym.fail} mismatch / incomplete: ${nsFail}   ${statusSym.skip} skipped: ${nsSkip}`
    );
    console.log(
      `  ACM (${ACM_REGION}): ${acmOk ? `${statusSym.ok} at least one ISSUED` : `${statusSym.warn} ${acmLine}`}`
    );
    console.log(
      `  CloudFront aliases: ${statusSym.ok} with aliases: ${cfAliasesOk}   ${statusSym.warn} none yet: ${cfAliasesWarn}`
    );
    console.log(
      `  HTTPS probes: ${statusSym.ok} ok: ${httpsOk}   ${statusSym.fail} failed: ${httpsFail}`
    );
    hr();
  }
}
