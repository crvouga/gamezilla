/**
 * Where the spec report of a commit lives. Every report is keyed by the full
 * commit sha and its variant, so runs of different code never share a key:
 *
 *   <sha>/frames/index.html      every step with its UI snapshot
 *   <sha>/no-frames/index.html   step timelines only
 *
 * The bucket and its public hostname are declared once, in
 * `libs/infra/tofu/global.tfvars.json` (`reports`).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const GLOBAL_TFVARS = resolve(
  import.meta.dir,
  '../../infra/tofu/global.tfvars.json'
);
const SHA = /^[0-9a-f]{40}$/;

export type ReportHosting = {
  readonly bucket: string;
  readonly hostname: string;
};

export function readReportHosting(): ReportHosting {
  const parsed = JSON.parse(readFileSync(GLOBAL_TFVARS, 'utf8')) as {
    readonly reports: ReportHosting;
  };
  return parsed.reports;
}

export function reportKey(sha: string, frames: boolean): string {
  if (!SHA.test(sha)) {
    throw new Error(`report key needs a full 40-hex commit sha, got "${sha}"`);
  }
  return `${sha}/${frames ? 'frames' : 'no-frames'}/index.html`;
}

export function reportUrl(
  hostname: string,
  sha: string,
  frames: boolean
): string {
  return `https://${hostname}/${reportKey(sha, frames)}`;
}
