/** `GET /o/oauth2/v2/auth` and the form target its screens post back to. */

import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

import {
  IDP_AUTHORIZE_SUBMIT_PATH,
  IDP_SESSION_COOKIE,
} from '../../shared/paths';
import type {
  IdpAccount,
  IdpAuthRequest,
  IdpBrowserSession,
} from '../../shared/types';
import type { IdpCtx } from '../idp-context';
import { ensureSession, markSignedIn, sweepExpired } from '../idp-state';
import { renderChooserPage } from '../pages/chooser-page';
import { renderConsentPage, renderErrorPage } from '../pages/consent-page';
import { renderSignInPage } from '../pages/signin-page';
import { type AuthorizeStep, nextAuthorizeStep } from './authorize-flow';
import {
  authorizeSuccessRedirect,
  issueAuthorizationCode,
} from './authorize-issue';
import {
  authorizeErrorRedirect,
  parseAuthorizeRequest,
} from './authorize-request';
import {
  authenticateSubmission,
  readSubmission,
  type Submission,
} from './authorize-submit';

function appNameFor(ctx: IdpCtx, request: IdpAuthRequest): string {
  return ctx.state.clients.get(request.clientId)?.appName ?? 'this app';
}

function attachSession(c: Context, session: IdpBrowserSession): void {
  setCookie(c, IDP_SESSION_COOKIE, session.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  });
}

function renderStep(args: {
  readonly c: Context;
  readonly ctx: IdpCtx;
  readonly request: IdpAuthRequest;
  readonly step: AuthorizeStep;
}): Response {
  const { c, ctx, request, step } = args;
  const appName = appNameFor(ctx, request);
  const shared = {
    submitPath: IDP_AUTHORIZE_SUBMIT_PATH,
    requestId: request.id,
    appName,
  };
  if (step.kind === 'chooser') {
    return c.html(
      renderChooserPage({ ...shared, accounts: step.accounts }),
      200
    );
  }
  if (step.kind === 'signin') {
    return c.html(
      renderSignInPage({ ...shared, email: step.email, error: step.error }),
      200
    );
  }
  if (step.kind === 'consent') {
    request.chosenSub = step.account.sub;
    return c.html(
      renderConsentPage({
        ...shared,
        account: step.account,
        scopes: request.scopes,
      }),
      200
    );
  }
  if (step.kind === 'error') {
    return c.redirect(
      authorizeErrorRedirect({
        redirectUri: request.redirectUri,
        state: request.state,
        error: step.error,
        detail: step.detail,
      }),
      302
    );
  }
  const code = issueAuthorizationCode({
    state: ctx.state,
    request,
    account: step.account,
    freshConsent: false,
  });
  ctx.state.authRequests.delete(request.id);
  return c.redirect(authorizeSuccessRedirect({ request, code }), 302);
}

export function handleAuthorize(c: Context, ctx: IdpCtx): Response {
  sweepExpired(ctx.state);
  const params = new URL(c.req.url).searchParams;
  const parsed = parseAuthorizeRequest(ctx.state, params);
  if (!parsed.ok) {
    const rejection = parsed.rejection;
    if (rejection.kind === 'page') {
      return c.html(
        renderErrorPage({
          status: rejection.status,
          error: rejection.error,
          detail: rejection.detail,
        }),
        rejection.status === 401 ? 401 : 400
      );
    }
    return c.redirect(
      authorizeErrorRedirect({
        redirectUri: params.get('redirect_uri') ?? '',
        state: params.get('state'),
        error: rejection.error,
        detail: rejection.detail,
      }),
      302
    );
  }
  const session = ensureSession(
    ctx.state,
    getCookie(c, IDP_SESSION_COOKIE) ?? null
  );
  attachSession(c, session);
  ctx.state.authRequests.set(parsed.request.id, parsed.request);
  const step = nextAuthorizeStep({
    state: ctx.state,
    request: parsed.request,
    session,
    chosen: null,
  });
  return renderStep({ c, ctx, request: parsed.request, step });
}

function completeConsent(args: {
  readonly c: Context;
  readonly ctx: IdpCtx;
  readonly request: IdpAuthRequest;
  readonly submission: Submission;
}): Response {
  const { c, ctx, request, submission } = args;
  const chosenSub = request.chosenSub;
  const account =
    chosenSub === null ? undefined : ctx.state.accounts.get(chosenSub);
  if (account === undefined) {
    return c.html(
      renderErrorPage({
        status: 400,
        error: 'invalid_request',
        detail: 'The chosen account no longer exists.',
      }),
      400
    );
  }
  if (submission.decision === 'deny') {
    ctx.state.authRequests.delete(request.id);
    return c.redirect(
      authorizeErrorRedirect({
        redirectUri: request.redirectUri,
        state: request.state,
        error: 'access_denied',
        detail: 'The user denied the request.',
      }),
      302
    );
  }
  const code = issueAuthorizationCode({
    state: ctx.state,
    request,
    account,
    freshConsent: true,
  });
  ctx.state.authRequests.delete(request.id);
  return c.redirect(authorizeSuccessRedirect({ request, code }), 302);
}

function advance(args: {
  readonly c: Context;
  readonly ctx: IdpCtx;
  readonly request: IdpAuthRequest;
  readonly chosen: IdpAccount;
}): Response {
  const { c, ctx, request, chosen } = args;
  const session = ensureSession(
    ctx.state,
    getCookie(c, IDP_SESSION_COOKIE) ?? null
  );
  markSignedIn(session, chosen.sub);
  attachSession(c, session);
  const step = nextAuthorizeStep({
    state: ctx.state,
    request,
    session,
    chosen,
  });
  return renderStep({ c, ctx, request, step });
}

export async function handleAuthorizeSubmit(
  c: Context,
  ctx: IdpCtx
): Promise<Response> {
  const submission = await readSubmission(c);
  const request = ctx.state.authRequests.get(submission.requestId);
  if (request === undefined) {
    return c.html(
      renderErrorPage({
        status: 400,
        error: 'invalid_request',
        detail:
          'This sign-in request expired. Return to the app and try again.',
      }),
      400
    );
  }
  if (submission.step === 'consent') {
    return completeConsent({ c, ctx, request, submission });
  }
  const authenticated = authenticateSubmission(ctx.state, submission);
  if (authenticated.kind === 'signin') {
    return c.html(
      renderSignInPage({
        submitPath: IDP_AUTHORIZE_SUBMIT_PATH,
        requestId: request.id,
        appName: appNameFor(ctx, request),
        email: authenticated.email,
        error: authenticated.error,
      }),
      authenticated.error === null ? 200 : 401
    );
  }
  return advance({ c, ctx, request, chosen: authenticated.account });
}
