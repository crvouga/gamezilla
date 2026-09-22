/**
 * `GET /o/oauth2/v2/auth`, its password and create-account screens, the back
 * arrow, and the form target.
 *
 * The only job left here is encoding: everything the screens decide lives in
 * `screen-service.ts`, shared with the `/rpc/*` routes. This module turns an
 * outcome into a `302` or an HTML document.
 */

import type { Context } from 'hono';

import type {
  IdpScreenOutcome,
  IdpScreenState,
} from '../../shared/screen-state';
import type { IdpAuthRequest } from '../../shared/types';
import { type IdpCtx, issuerOf } from '../idp-context';
import { renderFormPostHtml } from '../render/render-form-post';
import { renderScreenHtml } from '../render/render-screen';
import {
  authorizeErrorRedirect,
  parseAuthorizeRequest,
} from './authorize-request';
import { readSubmission, type Submission } from './authorize-submit';
import { sessionOf } from './idp-session';
import {
  applySubmission,
  appNameFor,
  IDP_EXPIRED_DETAIL,
  readScreenOutcome,
  type StepCtx,
  statusOf,
} from './screen-service';

async function renderScreen(
  c: Context,
  ctx: IdpCtx,
  state: IdpScreenState
): Promise<Response> {
  return await c.html(
    await renderScreenHtml(state, ctx.store.provider),
    statusOf({ kind: 'screen', state })
  );
}

async function renderOutcome(
  c: Context,
  ctx: IdpCtx,
  outcome: IdpScreenOutcome
): Promise<Response> {
  if (outcome.kind === 'redirect') return c.redirect(outcome.location, 302);
  if (outcome.kind === 'form_post') {
    return c.html(renderFormPostHtml(outcome), 200);
  }
  return await c.html(
    await renderScreenHtml(outcome.state, ctx.store.provider),
    statusOf(outcome)
  );
}

/** The provider refuses to redirect when the parked request is gone. */
async function renderExpired(c: Context, ctx: IdpCtx): Promise<Response> {
  return await renderScreen(c, ctx, {
    kind: 'error',
    status: 400,
    error: 'invalid_request',
    detail: IDP_EXPIRED_DETAIL,
  });
}

function stepOf(
  c: Context,
  ctx: IdpCtx,
  request: IdpAuthRequest,
  session: StepCtx['session']
): StepCtx {
  return { ctx, request, session, issuer: issuerOf(ctx, c) };
}
/** The parked request named by `?request_id=`, or `null` once it expired. */
async function parkedRequest(
  c: Context,
  ctx: IdpCtx
): Promise<IdpAuthRequest | null> {
  return await ctx.store.authRequest(c.req.query('request_id') ?? '');
}

export async function handleAuthorize(
  c: Context,
  ctx: IdpCtx
): Promise<Response> {
  await ctx.store.sweepExpired();
  const params = new URL(c.req.url).searchParams;
  const parsed = await parseAuthorizeRequest(ctx.store, params);
  if (!parsed.ok) {
    const rejection = parsed.rejection;
    if (rejection.kind === 'page') {
      return await renderScreen(c, ctx, {
        kind: 'error',
        status: rejection.status,
        error: rejection.error,
        detail: rejection.detail,
      });
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
  const session = await sessionOf(c, ctx.store);
  await ctx.store.putAuthRequest(parsed.request);
  return await renderOutcome(
    c,
    ctx,
    await readScreenOutcome(stepOf(c, ctx, parsed.request, session))
  );
}

/** The password step's own URL, so a refresh or a back button is a page load. */
export async function handleAuthorizePassword(
  c: Context,
  ctx: IdpCtx
): Promise<Response> {
  const request = await parkedRequest(c, ctx);
  if (request === null) return await renderExpired(c, ctx);
  const session = await sessionOf(c, ctx.store);
  return await renderOutcome(
    c,
    ctx,
    await readScreenOutcome(stepOf(c, ctx, request, session))
  );
}

/** The create-account screen, reachable from sign-in and from the chooser. */
export async function handleAuthorizeCreate(
  c: Context,
  ctx: IdpCtx
): Promise<Response> {
  const request = await parkedRequest(c, ctx);
  if (request === null) return await renderExpired(c, ctx);
  await sessionOf(c, ctx.store);
  return await renderScreen(c, ctx, {
    kind: 'create-account',
    requestId: request.id,
    appName: await appNameFor(ctx, request),
    name: '',
    email: '',
    error: null,
  });
}

/**
 * The back arrow: it clears both parked choices and shows the step the human
 * came from — the account picker when the browser knows accounts, the sign-in
 * card otherwise, which is Google's own behaviour on its consent screen.
 */
export async function handleAuthorizeBack(
  c: Context,
  ctx: IdpCtx
): Promise<Response> {
  const request = await parkedRequest(c, ctx);
  if (request === null) return await renderExpired(c, ctx);
  const session = await sessionOf(c, ctx.store);
  await ctx.store.chooseAuthRequestAccount(request.id, null);
  await ctx.store.setAuthRequestIdentifier(request.id, null);
  const accounts = await ctx.store.sessionAccounts(session);
  if (accounts.length === 0) {
    return await renderOutcome(
      c,
      ctx,
      await readScreenOutcome(stepOf(c, ctx, request, session))
    );
  }
  return await renderScreen(c, ctx, {
    kind: 'chooser',
    requestId: request.id,
    appName: await appNameFor(ctx, request),
    accounts,
  });
}

export async function handleAuthorizeSubmit(
  c: Context,
  ctx: IdpCtx
): Promise<Response> {
  const submission: Submission = await readSubmission(c);
  const request = await ctx.store.authRequest(submission.requestId);
  if (request === null) return await renderExpired(c, ctx);
  const session = await sessionOf(c, ctx.store);
  return await renderOutcome(
    c,
    ctx,
    await applySubmission({
      ...stepOf(c, ctx, request, session),
      submission,
    })
  );
}
