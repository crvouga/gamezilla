/**
 * The markup contract of the provider's screens: same form shape, same test
 * ids, two sign-in steps, plus the autocomplete affordances a person expects
 * from any sign-in page and the boot state the SPA picks up.
 */

import { describe, expect, test } from 'bun:test';

import {
  IDP_AUTHORIZE_BACK_PATH,
  IDP_AUTHORIZE_CREATE_PATH,
  IDP_AUTHORIZE_PASSWORD_PATH,
  IDP_AUTHORIZE_SUBMIT_PATH,
  IDP_BOOT_STATE_ELEMENT_ID,
  IDP_BRAND,
  IDP_PASSWORD,
  IDP_TEST_IDS,
} from '@pkgs/idp-sim/shared';

import {
  authorizeUrl,
  createAccountViaScreen,
  createIdpFixture,
  formBody,
  hiddenFieldsOf,
  type IdpBrowser,
  requestIdOf,
  screenStateOf,
  signInWithPassword,
  submitIdentifier,
  submitPassword,
} from './harness';

function firstForm(html: string): string {
  return /<form\b[^>]*>[\s\S]*?<\/form>/i.exec(html)?.[0] ?? '';
}

/** Attribute value of the first tag carrying `data-testid="<testId>"`. */
function attrOfTestId(html: string, testId: string, attribute: string): string {
  return (
    new RegExp(`${attribute}="([^"]*)"`).exec(tagOfTestId(html, testId))?.[1] ??
    ''
  );
}

/** The whole tag carrying `data-testid="<testId>"`. */
function tagOfTestId(html: string, testId: string): string {
  return (
    new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? ''
  );
}

/** Submit step 1 with alice and return the password screen's markup. */
async function passwordPage(browser: IdpBrowser): Promise<string> {
  const identifier = await browser.fetch(authorizeUrl());
  const submitted = await submitIdentifier(
    browser,
    await identifier.text(),
    'alice@gmail.com'
  );
  return await submitted.text();
}

describe('idp page markup', () => {
  test('step 1 asks for the address and offers the local directory', async () => {
    const fixture = await createIdpFixture();
    const html = await (await fixture.browser().fetch(authorizeUrl())).text();
    const form = firstForm(html);

    expect(html).toContain(IDP_TEST_IDS.identifierPage);
    expect(screenStateOf(html).kind).toBe('identifier');
    expect(form).toContain(`method="post"`);
    expect(form).toContain(`action="${IDP_AUTHORIZE_SUBMIT_PATH}"`);
    expect(hiddenFieldsOf(html)['step']).toBe('identifier');
    expect(html.indexOf('name="request_id"')).toBeLessThan(
      html.indexOf('name="step"')
    );
    expect(form).not.toContain('name="password"');

    expect(attrOfTestId(html, IDP_TEST_IDS.identifierEmail, 'aria-label')).toBe(
      'Email or phone'
    );
    expect(attrOfTestId(html, IDP_TEST_IDS.identifierEmail, 'type')).toBe(
      'text'
    );
    expect(attrOfTestId(html, IDP_TEST_IDS.identifierEmail, 'inputmode')).toBe(
      'email'
    );
    expect(
      attrOfTestId(html, IDP_TEST_IDS.identifierEmail, 'autocomplete')
    ).toBe('username');
    expect(tagOfTestId(html, IDP_TEST_IDS.identifierEmail)).not.toContain(
      'list='
    );
    expect(html).not.toContain('<datalist');
    expect(html).toContain('alice@gmail.com');
    expect(html).toContain('bob@gmail.com');
    expect(html).toContain(IDP_TEST_IDS.identifierCreateAccount);
    expect(html).toContain('/o/oauth2/v2/auth/create?request_id=');

    const boot = new RegExp(
      `<script type="application/json" id="${IDP_BOOT_STATE_ELEMENT_ID}">`
    );
    expect(boot.test(html)).toBe(true);
  });

  test('step 2 asks for the password and states the local one', async () => {
    const fixture = await createIdpFixture();
    const html = await passwordPage(fixture.browser());
    const form = firstForm(html);

    expect(html).toContain(IDP_TEST_IDS.passwordPage);
    expect(html).toContain('Welcome');
    expect(html).toContain('alice@gmail.com');
    expect(screenStateOf(html).kind).toBe('password');
    expect(hiddenFieldsOf(html)['step']).toBe('password');
    expect(form).not.toContain('name="email"');

    expect(attrOfTestId(html, IDP_TEST_IDS.passwordInput, 'type')).toBe(
      'password'
    );
    expect(attrOfTestId(html, IDP_TEST_IDS.passwordInput, 'autocomplete')).toBe(
      'current-password'
    );
    expect(attrOfTestId(html, IDP_TEST_IDS.passwordInput, 'aria-label')).toBe(
      'Password'
    );
    expect(attrOfTestId(html, IDP_TEST_IDS.passwordShow, 'role')).toBe(
      'checkbox'
    );
    expect(attrOfTestId(html, IDP_TEST_IDS.passwordShow, 'aria-checked')).toBe(
      'false'
    );
    expect(html).toContain(`<code>${IDP_PASSWORD}</code>`);
  });

  test('the chooser keeps each email inside its own account button', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    await signInWithPassword(browser, authorizeUrl(), 'alice@gmail.com');
    const html = await (
      await browser.fetch(authorizeUrl({ prompt: 'select_account' }))
    ).text();
    expect(html).toContain(IDP_TEST_IDS.chooserPage);
    expect(
      /<button[^>]*data-testid="idp-chooser-account-[^"]*"[^>]*>[\s\S]*?alice@gmail\.com[\s\S]*?<\/button>/.test(
        html
      )
    ).toBe(true);
    expect(html).toContain(IDP_TEST_IDS.chooserUseAnother);
    expect(html).toContain(IDP_TEST_IDS.chooserCreateAccount);
    expect(hiddenFieldsOf(html)['step']).toBe('choose');
  });

  test('the create screen collects a name and an email, never a password', async () => {
    const fixture = await createIdpFixture();
    const html = await (await fixture.browser().fetch(authorizeUrl())).text();
    const requestId = requestIdOf(html);
    const page = await (
      await fixture
        .browser()
        .fetch(`${IDP_AUTHORIZE_CREATE_PATH}?request_id=${requestId}`)
    ).text();
    expect(page).toContain(IDP_TEST_IDS.createAccountPage);
    expect(hiddenFieldsOf(page)['step']).toBe('create');
    expect(hiddenFieldsOf(page)['request_id']).toBe(requestId);
    expect(firstForm(page)).not.toContain('name="password"');
    expect(
      attrOfTestId(page, IDP_TEST_IDS.createAccountName, 'autocomplete')
    ).toBe('name');
    expect(
      attrOfTestId(page, IDP_TEST_IDS.createAccountEmail, 'autocomplete')
    ).toBe('email');
    expect(
      attrOfTestId(page, IDP_TEST_IDS.createAccountEmail, 'inputmode')
    ).toBe('email');
    expect(page).toContain(`<code>${IDP_PASSWORD}</code>`);
  });

  test('an unknown address is refused on step 1, autofocused', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const html = await (await browser.fetch(authorizeUrl())).text();
    const res = await submitIdentifier(browser, html, 'nobody@gmail.com');
    expect(res.status).toBe(401);
    const refused = await res.text();
    expect(screenStateOf(refused).kind).toBe('identifier');
    expect(refused).toContain(IDP_TEST_IDS.identifierError);
    expect(refused).toContain(`Couldn't find your ${IDP_BRAND.name} account`);
    expect(refused).toContain('role="alert"');
    expect(
      attrOfTestId(refused, IDP_TEST_IDS.identifierEmail, 'aria-invalid')
    ).toBe('true');
    expect(tagOfTestId(refused, IDP_TEST_IDS.identifierEmail)).toContain(
      'autofocus'
    );
    expect(attrOfTestId(refused, IDP_TEST_IDS.identifierEmail, 'value')).toBe(
      'nobody@gmail.com'
    );
  });

  test('a wrong password marks step 2 and is announced', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const res = await submitPassword(
      browser,
      await passwordPage(browser),
      'not-the-password'
    );
    expect(res.status).toBe(401);
    const refused = await res.text();
    expect(refused).toContain(IDP_TEST_IDS.passwordError);
    expect(refused).toContain('role="alert"');
    expect(tagOfTestId(refused, IDP_TEST_IDS.passwordInput)).toContain(
      'autofocus'
    );
    expect(
      attrOfTestId(refused, IDP_TEST_IDS.passwordInput, 'aria-invalid')
    ).toBe('true');
  });

  test('invalid input marks the create fields and keeps what was typed', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const signInPage = await (await browser.fetch(authorizeUrl())).text();
    const res = await createAccountViaScreen(browser, signInPage, {
      name: 'Keep Me',
      email: 'not an email',
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(
      attrOfTestId(html, IDP_TEST_IDS.createAccountEmail, 'aria-invalid')
    ).toBe('true');
    expect(attrOfTestId(html, IDP_TEST_IDS.createAccountEmail, 'value')).toBe(
      'not an email'
    );
    expect(attrOfTestId(html, IDP_TEST_IDS.createAccountName, 'value')).toBe(
      'Keep Me'
    );
    expect(html).toContain('role="alert"');
  });

  test('an untrusted request still renders the error card, not a form', async () => {
    const fixture = await createIdpFixture();
    const res = await fixture
      .browser()
      .fetch(authorizeUrl({ client_id: 'nobody.apps.googleusercontent.com' }));
    expect(res.status).toBe(401);
    const html = await res.text();
    expect(html).toContain(IDP_TEST_IDS.errorPage);
    expect(screenStateOf(html).kind).toBe('error');
    expect(firstForm(html)).toBe('');
  });
});

describe('idp screen navigation', () => {
  test('the back arrow returns to the account picker, then to step 1', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const done = await signInWithPassword(
      browser,
      authorizeUrl(),
      'alice@gmail.com'
    );
    expect(done.status).toBe(302);

    const consent = await (
      await browser.fetch(authorizeUrl({ prompt: 'consent' }))
    ).text();
    const requestId = requestIdOf(consent);
    const backHref = attrOfTestId(consent, IDP_TEST_IDS.back, 'href');
    expect(backHref).toContain(requestId);

    const back = await (await browser.fetch(backHref)).text();
    expect(back).toContain(IDP_TEST_IDS.chooserPage);
    expect(hiddenFieldsOf(back)['step']).toBe('choose');
    expect(
      /data-testid="idp-chooser-account-[^"]*"[^>]*>[\s\S]*?alice@gmail\.com/.test(
        back
      )
    ).toBe(true);

    // "Use another account" is the way back to step 1.
    const stepOne = await browser.fetch(
      IDP_AUTHORIZE_SUBMIT_PATH,
      formBody({ request_id: requestId, step: 'choose', sub: '' })
    );
    const stepOneHtml = await stepOne.text();
    expect(stepOneHtml).toContain(IDP_TEST_IDS.identifierPage);
    expect(hiddenFieldsOf(stepOneHtml)['step']).toBe('identifier');
  });

  test('the password step has its own URL for refreshes', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const page = await passwordPage(browser);
    const requestId = requestIdOf(page);
    const reloaded = await (
      await browser.fetch(
        `${IDP_AUTHORIZE_PASSWORD_PATH}?request_id=${encodeURIComponent(requestId)}`
      )
    ).text();
    expect(reloaded).toContain(IDP_TEST_IDS.passwordPage);
    expect(screenStateOf(reloaded).kind).toBe('password');
    expect(attrOfTestId(reloaded, IDP_TEST_IDS.back, 'href')).toContain(
      requestId
    );
  });

  test('the create screen leads back to sign-in', async () => {
    const fixture = await createIdpFixture();
    const browser = fixture.browser();
    const html = await (await browser.fetch(authorizeUrl())).text();
    const requestId = requestIdOf(html);
    const create = await (
      await browser.fetch(
        `${IDP_AUTHORIZE_CREATE_PATH}?request_id=${encodeURIComponent(requestId)}`
      )
    ).text();
    expect(create).toContain(IDP_TEST_IDS.createAccountPage);
    expect(attrOfTestId(create, IDP_TEST_IDS.back, 'href')).toContain(
      requestId
    );
    expect(create).toContain('Sign in instead');

    const back = await (
      await browser.fetch(`${IDP_AUTHORIZE_BACK_PATH}?request_id=${requestId}`)
    ).text();
    expect(back).toContain(IDP_TEST_IDS.identifierPage);
    expect(back).toContain(IDP_TEST_IDS.identifierAccounts);
  });
});
