/**
 * The `response_mode=form_post` document: a form that POSTs the authorization
 * response to the relying party's redirect URI, submitted by script the
 * moment it loads. The same markup works without JavaScript (one Continue
 * button) and for headless walkers, which read it as "the next form".
 *
 * This is a cross-site top-level POST from the provider's origin to the
 * relying party, exactly as Apple sends it — so a callback that only accepts
 * GET, or that relies on a `SameSite=Lax` cookie to find its state, fails
 * here the way it would fail in production.
 */

import { IDP_BRAND } from '../../shared/brand';
import type { IdpScreenOutcome } from '../../shared/screen-state';
import { IDP_TEST_IDS } from '../../shared/test-ids';

type FormPost = Extract<IdpScreenOutcome, { kind: 'form_post' }>;

function escapeAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function renderFormPostHtml(outcome: FormPost): string {
  const inputs = Object.entries(outcome.fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeAttr(name)}" value="${escapeAttr(value)}">`
    )
    .join('');
  return [
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">',
    `<title>Redirecting · ${IDP_BRAND.name}</title></head>`,
    `<body data-testid="${IDP_TEST_IDS.formPostPage}">`,
    `<form method="post" action="${escapeAttr(outcome.action)}">${inputs}`,
    `<noscript><button type="submit" data-testid="${IDP_TEST_IDS.formPostContinue}">Continue</button></noscript>`,
    '</form>',
    '<script>document.forms[0].submit();</script>',
    '</body></html>',
  ].join('');
}
