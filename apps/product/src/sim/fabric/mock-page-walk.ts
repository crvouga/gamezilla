import type { ServerHttp } from '@apps/client/shell/client-env';
import {
  formSubmitBody,
  type HeadlessButton,
  type HeadlessForm,
  parseFirstForm,
} from '@pkgs/auth/client';

const MAX_HOPS = 8;

/** The next in-app url from a redirect, or `null` when the chain left us. */
function nextHop(
  location: string | null,
  base: string,
  appOrigin: string
): string | null {
  if (location === null) return null;
  const next = new URL(location, base).toString();
  return next.startsWith(appOrigin) ? next : null;
}

function chooseButton(
  form: HeadlessForm,
  buttonTestId: string | undefined
): HeadlessButton | null {
  if (buttonTestId === undefined) return form.buttons[0] ?? null;
  return form.buttons.find((button) => button.testId === buttonTestId) ?? null;
}

/**
 * Walk the fake provider's mock pages the way a browser would: follow
 * in-app redirects, submit the first form (pressing `buttonTestId` when given)
 * and stop once the chain leaves the app origin.
 */
export async function walkMockPage(args: {
  readonly fetch: ServerHttp;
  readonly startUrl: string;
  readonly appOrigin: string;
  readonly buttonTestId?: string;
}): Promise<void> {
  let url = args.startUrl;
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const response = await args.fetch(url, {
      method: 'GET',
      redirect: 'manual',
    });
    const redirected = nextHop(
      response.headers.get('location'),
      url,
      args.appOrigin
    );
    if (redirected !== null) {
      url = redirected;
      continue;
    }
    const form = parseFirstForm(await response.text());
    if (form === null) {
      throw new Error('sim mock billing: page has no form');
    }
    const button = chooseButton(form, args.buttonTestId);
    const action = new URL(form.action, url).toString();
    const submitted = await args.fetch(action, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formSubmitBody({ form, typed: {}, button }),
      redirect: 'manual',
    });
    const after = nextHop(
      submitted.headers.get('location'),
      action,
      args.appOrigin
    );
    if (after === null) return;
    url = after;
  }
}
