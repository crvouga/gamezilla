import { spawnSync } from 'node:child_process';
import { SETUP_DNS_DOMAINS } from './dns-config';
import type { TfOutputs } from '../deployment-pipeline-cli/tf-outputs';

export interface DnsDomainResult {
  domain: string;
  delegated: boolean;
  message: string;
}

export interface DnsDelegationResult {
  delegated: boolean;
  details: DnsDomainResult[];
}

export function checkDnsDelegation(outputs: TfOutputs): DnsDelegationResult {
  const details: DnsDomainResult[] = [];

  for (const { domain, outputKey } of SETUP_DNS_DOMAINS) {
    const expectedRaw = outputs[outputKey];
    if (!expectedRaw || expectedRaw === '') {
      details.push({ domain, delegated: false, message: 'no NS output — hosted zone not created yet' });
      continue;
    }

    const expected = parseNs(expectedRaw);
    const result = spawnSync('dig', ['NS', domain, '+short'], {
      encoding: 'utf-8',
      timeout: 15_000,
    });
    if (result.error || (result.status !== null && result.status !== 0)) {
      details.push({ domain, delegated: false, message: 'dig failed — cannot verify NS delegation' });
      continue;
    }

    const actual = parseNs(result.stdout);
    if (actual.size === 0) {
      details.push({ domain, delegated: false, message: 'no public NS records — delegation not configured at registrar' });
      continue;
    }

    const missing = [...expected].filter((ns) => !actual.has(ns));
    if (missing.length > 0) {
      details.push({ domain, delegated: false, message: `NS mismatch — missing: ${missing.join(', ')}` });
    } else {
      details.push({ domain, delegated: true, message: `${actual.size} NS records match Route 53` });
    }
  }

  return {
    delegated: details.length > 0 && details.every((d) => d.delegated),
    details,
  };
}

export function parseNs(raw: string): Set<string> {
  return new Set(
    raw
      .split(/[\n,]+/)
      .map((s) => s.trim().toLowerCase().replace(/\.$/, ''))
      .filter((s) => s.length > 0),
  );
}
