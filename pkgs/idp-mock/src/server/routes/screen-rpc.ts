/**
 * `/rpc/*`: the same steps the HTML forms take, encoded as JSON outcomes.
 *
 * The step value is fixed by the route (the browser app never chooses it), and
 * every handler ends in `applySubmission` — the same call the `POST` form
 * target makes — so the RPC path and the no-JS path cannot diverge.
 */

import { type Context, Hono } from 'hono';

import type { IdpScreenOutcome } from '../../shared/screen-state';
import { type IdpCtx, issuerOf } from '../idp-context';
import {
  emailChoiceField,
  optionalField,
  type Submission,
  type SubmissionStep,
} from './authorize-submit';
import { sessionOf } from './idp-session';
import {
  applySubmission,
  errorState,
  IDP_EXPIRED_DETAIL,
  readScreenOutcome,
  type StepCtx,
} from './screen-service';

type Body = Record<string, unknown>;

function text(body: Body, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : '';
}

async function submissionOf(
  c: Context,
  step: SubmissionStep
): Promise<Submission> {
  const body = (await c.req.json()) as Body;
  const sub = text(body, 'sub');
  return {
    requestId: text(body, 'request_id'),
    step,
    sub: sub.length > 0 ? sub : null,
    email: text(body, 'email'),
    name: text(body, 'name'),
    password: text(body, 'password'),
    decision: text(body, 'decision') === 'deny' ? 'deny' : 'allow',
    givenName: optionalField(body, 'given_name'),
    familyName: optionalField(body, 'family_name'),
    emailChoice: emailChoiceField(body),
  };
}

/** The parked request plus the browser session behind one RPC call. */
async function stepContext(
  c: Context,
  ctx: IdpCtx,
  submission: Submission
): Promise<StepCtx | null> {
  const request = await ctx.store.authRequest(submission.requestId);
  if (request === null) return null;
  return {
    ctx,
    request,
    session: await sessionOf(c, ctx.store),
    issuer: issuerOf(ctx, c),
  };
}

function expired(): IdpScreenOutcome {
  return errorState(400, 'invalid_request', IDP_EXPIRED_DETAIL);
}

function stepRoute(ctx: IdpCtx, step: SubmissionStep) {
  return async (c: Context): Promise<Response> => {
    const submission = await submissionOf(c, step);
    const context = await stepContext(c, ctx, submission);
    if (context === null) return c.json(expired());
    return c.json(await applySubmission({ ...context, submission }));
  };
}

export function createScreenRpcApp(ctx: IdpCtx) {
  return new Hono()
    .get('/screen', async (c) => {
      const request = await ctx.store.authRequest(
        c.req.query('request_id') ?? ''
      );
      if (request === null) return c.json(expired());
      const session = await sessionOf(c, ctx.store);
      return c.json(
        await readScreenOutcome({
          ctx,
          request,
          session,
          issuer: issuerOf(ctx, c),
        })
      );
    })
    .post('/identifier', stepRoute(ctx, 'identifier'))
    .post('/password', stepRoute(ctx, 'password'))
    .post('/choose', stepRoute(ctx, 'choose'))
    .post('/create-account', stepRoute(ctx, 'create'))
    .post('/consent', stepRoute(ctx, 'consent'));
}
