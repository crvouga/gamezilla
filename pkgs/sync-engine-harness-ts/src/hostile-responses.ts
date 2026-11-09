/**
 * What a hostile or broken network answers instead of the server: a
 * captive-portal sign-in page, a refusal from a proxy, silence, or a reply
 * whose verdict list no longer matches the writes that were sent.
 */

import type { MutationUploadResult } from '@pkgs/sync-engine-client-ts/mutation-upload-queue';

/** How a mutations reply's verdict list is mangled after the server applied. */
export type VerdictCorruption =
  | 'unknownStatus'
  | 'unknownId'
  | 'missingVerdict'
  | 'duplicateVerdict'
  | 'rejectedWithoutCode'
  | 'notOk';

export const VERDICT_CORRUPTIONS: readonly VerdictCorruption[] = [
  'unknownStatus',
  'unknownId',
  'missingVerdict',
  'duplicateVerdict',
  'rejectedWithoutCode',
  'notOk',
];

/** A Wi-Fi sign-in page answering 200 for any URL. */
export const CAPTIVE_PORTAL_HTML =
  '<!doctype html><html><head><title>Sign in to Wi-Fi</title></head>' +
  '<body><form action="/login"><button>Connect</button></form></body></html>';

type LooseVerdict = Record<string, unknown>;

function verdictsOf(body: MutationUploadResult): LooseVerdict[] {
  return body.verdicts.map((verdict) => ({ ...verdict }));
}

/**
 * `body` with its verdicts mangled by `variant`. The result is what reaches
 * the device; the server has already applied (or refused) every write.
 */
export function corruptVerdicts(
  body: MutationUploadResult,
  variant: VerdictCorruption
): unknown {
  const verdicts = verdictsOf(body);
  // A refusal is the verdict whose loss a person would notice: aim at it.
  const target =
    verdicts.find((verdict) => verdict['status'] === 'rejected') ?? verdicts[0];
  if (target === undefined) return body;
  const first = target;
  switch (variant) {
    case 'unknownStatus':
      first['status'] = 'error';
      break;
    case 'unknownId':
      first['mutationId'] = `${String(first['mutationId'])}-unknown`;
      break;
    case 'missingVerdict':
      verdicts.pop();
      break;
    case 'duplicateVerdict': {
      const other = verdicts.findIndex((verdict) => verdict !== first);
      if (other >= 0) verdicts[other] = { ...first };
      break;
    }
    case 'rejectedWithoutCode':
      first['status'] = 'rejected';
      delete first['code'];
      delete first['message'];
      break;
    case 'notOk':
      return { ...body, ok: false, verdicts };
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
  return { ...body, verdicts };
}
