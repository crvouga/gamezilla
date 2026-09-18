/**
 * The single step engine behind every IdP screen.
 *
 * The HTML form target and the `/rpc/*` routes both come through here and only
 * differ in how they encode the outcome (302 vs JSON), so the decision table,
 * the password check and the grant logic exist exactly once. `nextAuthorizeStep`
 * stays the decision table; this module maps it onto {@link IdpScreenState}.
 */

import type {
  IdpScreenOutcome,
  IdpScreenState,
} from '../../shared/screen-state';
import {
  IDP_PASSWORD,
  type IdpAccount,
  type IdpAuthRequest,
  type IdpBrowserSession,
} from '../../shared/types';
import type { IdpCtx } from '../idp-context';
import { DUPLICATE_EMAIL_ERROR, parseAccountDraft } from './account-creation';
import {
  type AuthorizeStep,
  nextAuthorizeStep,
  nextChosenStep,
} from './authorize-flow';
import {
  authorizeSuccessRedirect,
  issueAuthorizationCode,
} from './authorize-issue';
import { authorizeErrorRedirect } from './authorize-request';
import {
  NO_ACCOUNT_ERROR,
  type Submission,
  WRONG_PASSWORD_ERROR,
} from './authorize-submit';

export const IDP_EXPIRED_DETAIL =
  'This sign-in request expired. Return to the app and try again.';

export type StepCtx = {
  readonly ctx: IdpCtx;
  readonly request: IdpAuthRequest;
  readonly session: IdpBrowserSession;
};

export function screenState(state: IdpScreenState): IdpScreenOutcome {
  return { kind: 'screen', state };
}

export function errorState(
  status: number,
  error: string,
  detail: string
): IdpScreenOutcome {
  return screenState({ kind: 'error', status, error, detail });
}

export async function appNameFor(
  ctx: IdpCtx,
  request: IdpAuthRequest
): Promise<string> {
  const client = await ctx.store.client(request.clientId);
  return client?.appName ?? 'this app';
}

/** The HTTP status the HTML host answers with; the RPC host always says 200. */
export function statusOf(outcome: IdpScreenOutcome): 200 | 302 | 400 | 401 {
  if (outcome.kind === 'redirect') return 302;
  const state = outcome.state;
  if (state.kind === 'error') {
    return state.status === 401 ? 401 : 400;
  }
  if (state.kind === 'create-account') return state.error === null ? 200 : 400;
  if (state.kind === 'identifier' || state.kind === 'password') {
    return state.error === null ? 200 : 401;
  }
  return 200;
}

async function issue(
  args: StepCtx,
  account: IdpAccount,
  freshConsent: boolean
): Promise<IdpScreenOutcome> {
  const { ctx, request } = args;
  const code = await ctx.store.tx(async (store) => {
    const minted = await issueAuthorizationCode({
      store,
      request,
      account,
      freshConsent,
    });
    await store.deleteAuthRequest(request.id);
    return minted;
  });
  return {
    kind: 'redirect',
    location: authorizeSuccessRedirect({ request, code }),
  };
}

/** Consent, or straight to a code when these scopes are already approved. */
async function advance(
  args: StepCtx,
  account: IdpAccount
): Promise<IdpScreenOutcome> {
  const step = await nextChosenStep({
    store: args.ctx.store,
    request: args.request,
    account,
  });
  if (step.kind === 'error') {
    return { kind: 'redirect', location: errorRedirect(args.request, step) };
  }
  if (step.kind === 'consent') {
    await args.ctx.store.chooseAuthRequestAccount(args.request.id, account.sub);
    return screenState({
      kind: 'consent',
      requestId: args.request.id,
      appName: await appNameFor(args.ctx, args.request),
      account,
      scopes: args.request.scopes,
    });
  }
  return await issue(args, account, false);
}

function errorRedirect(
  request: IdpAuthRequest,
  step: { readonly error: string; readonly detail: string }
): string {
  return authorizeErrorRedirect({
    redirectUri: request.redirectUri,
    state: request.state,
    error: step.error,
    detail: step.detail,
  });
}

/** Identifier, or the password step when step 1 already parked an address. */
async function credentialScreen(args: StepCtx): Promise<IdpScreenOutcome> {
  const { ctx, request } = args;
  const parked = request.identifierEmail;
  const appName = await appNameFor(ctx, request);
  if (parked === null) {
    return screenState({
      kind: 'identifier',
      requestId: request.id,
      appName,
      email: request.loginHint ?? '',
      error: null,
      accounts: await ctx.store.accounts(),
    });
  }
  const account = await ctx.store.accountByEmail(parked);
  if (account === null) {
    return await identifierProblem(args, parked, appName);
  }
  return screenState({
    kind: 'password',
    requestId: request.id,
    appName,
    account,
    error: null,
    hasPasskey: false,
  });
}

async function identifierProblem(
  args: StepCtx,
  email: string,
  appName: string
): Promise<IdpScreenOutcome> {
  return screenState({
    kind: 'identifier',
    requestId: args.request.id,
    appName,
    email,
    error: NO_ACCOUNT_ERROR,
    accounts: await args.ctx.store.accounts(),
  });
}

/** What the parked request's current step looks like, without submitting. */
export async function readScreenOutcome(
  args: StepCtx
): Promise<IdpScreenOutcome> {
  if (args.request.identifierEmail !== null) {
    return await credentialScreen(args);
  }
  const step: AuthorizeStep = await nextAuthorizeStep({
    store: args.ctx.store,
    request: args.request,
    session: args.session,
    chosen: null,
  });
  const appName = await appNameFor(args.ctx, args.request);
  if (step.kind === 'chooser') {
    return screenState({
      kind: 'chooser',
      requestId: args.request.id,
      appName,
      accounts: step.accounts,
    });
  }
  if (step.kind === 'consent') {
    await args.ctx.store.chooseAuthRequestAccount(
      args.request.id,
      step.account.sub
    );
    return screenState({
      kind: 'consent',
      requestId: args.request.id,
      appName,
      account: step.account,
      scopes: args.request.scopes,
    });
  }
  if (step.kind === 'error') {
    return { kind: 'redirect', location: errorRedirect(args.request, step) };
  }
  if (step.kind === 'issue') {
    return await issue(args, step.account, false);
  }
  return await credentialScreen(args);
}

async function applyIdentifier(
  args: StepCtx,
  email: string
): Promise<IdpScreenOutcome> {
  const { ctx, request } = args;
  const appName = await appNameFor(ctx, request);
  const account = await ctx.store.accountByEmail(email);
  if (account === null) return await identifierProblem(args, email, appName);
  await ctx.store.setAuthRequestIdentifier(request.id, account.email);
  return screenState({
    kind: 'password',
    requestId: request.id,
    appName,
    account,
    error: null,
    hasPasskey: false,
  });
}

async function applyPassword(
  args: StepCtx,
  password: string
): Promise<IdpScreenOutcome> {
  const { ctx, request, session } = args;
  const email = request.identifierEmail;
  const account = email === null ? null : await ctx.store.accountByEmail(email);
  if (account === null) {
    return await identifierProblem(
      args,
      email ?? '',
      await appNameFor(ctx, request)
    );
  }
  if (password !== IDP_PASSWORD) {
    return screenState({
      kind: 'password',
      requestId: request.id,
      appName: await appNameFor(ctx, request),
      account,
      error: WRONG_PASSWORD_ERROR,
      hasPasskey: false,
    });
  }
  const signedIn = await ctx.store.markSignedIn(session.id, account.sub);
  return await advance({ ctx, request, session: signedIn }, account);
}

async function applyChoose(
  args: StepCtx,
  sub: string | null
): Promise<IdpScreenOutcome> {
  const { ctx, request, session } = args;
  if (sub === null) return await credentialScreen(args);
  const account = await ctx.store.accountBySub(sub);
  if (account === null) {
    return await identifierProblem(args, '', await appNameFor(ctx, request));
  }
  const signedIn = await ctx.store.markSignedIn(session.id, account.sub);
  return await advance({ ctx, request, session: signedIn }, account);
}

async function applyCreateAccount(
  args: StepCtx,
  submission: Submission
): Promise<IdpScreenOutcome> {
  const { ctx, request, session } = args;
  const appName = await appNameFor(ctx, request);
  const values = { name: submission.name, email: submission.email };
  const invalid = (error: string): IdpScreenOutcome =>
    screenState({
      kind: 'create-account',
      requestId: request.id,
      appName,
      ...values,
      error,
    });
  const parsed = parseAccountDraft(values);
  if (!parsed.ok) return invalid(parsed.error);
  if ((await ctx.store.accountByEmail(parsed.draft.email)) !== null) {
    return invalid(DUPLICATE_EMAIL_ERROR);
  }
  const created = await ctx.store.tx(async (store) => {
    const account = await store.upsertAccount(parsed.draft);
    const signedIn = await store.markSignedIn(session.id, account.sub);
    return { account, session: signedIn };
  });
  return await advance(
    { ctx, request, session: created.session },
    created.account
  );
}

async function applyConsent(
  args: StepCtx,
  decision: 'allow' | 'deny'
): Promise<IdpScreenOutcome> {
  const { ctx, request } = args;
  const chosenSub = request.chosenSub;
  const account =
    chosenSub === null ? null : await ctx.store.accountBySub(chosenSub);
  if (account === null) {
    return errorState(
      400,
      'invalid_request',
      'The chosen account no longer exists.'
    );
  }
  if (decision === 'deny') {
    await ctx.store.deleteAuthRequest(request.id);
    return {
      kind: 'redirect',
      location: errorRedirect(request, {
        error: 'access_denied',
        detail: 'The user denied the request.',
      }),
    };
  }
  return await issue(args, account, true);
}

/** Run one submitted step. The HTML and RPC hosts both call exactly this. */
export async function applySubmission(
  args: StepCtx & { readonly submission: Submission }
): Promise<IdpScreenOutcome> {
  const { submission } = args;
  switch (submission.step) {
    case 'identifier':
      return await applyIdentifier(args, submission.email);
    case 'password':
      return await applyPassword(args, submission.password);
    case 'choose':
      return await applyChoose(args, submission.sub);
    case 'create':
      return await applyCreateAccount(args, submission);
    case 'consent':
      return await applyConsent(args, submission.decision);
  }
}
