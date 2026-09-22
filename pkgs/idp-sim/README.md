# `@pkgs/idp-sim`

A **simulated identity provider** — not a stub — that speaks either
**Google's** wire or **Sign in with Apple's**, picked per instance
(`provider: 'google' | 'apple'`, `IDP_PROVIDER` for the standalone server).

It owns its own account directory, browser sessions, consent grants, signing
keys and tokens. As Google it serves Google's documented endpoints:

| Path | Purpose |
| --- | --- |
| `/.well-known/openid-configuration` | discovery |
| `/oauth2/v3/certs` | JWKS for `id_token` verification |
| `/o/oauth2/v2/auth` | authorize — address step, chooser, consent |
| `/o/oauth2/v2/auth/password` | password step ("Welcome"), a real URL |
| `/o/oauth2/v2/auth/create` | create-account screen (name + email) |
| `/rpc/*` | typed Hono RPC the SPA's step transitions use |
| `/idp-assets/app.js`, `app.css`, `favicon.svg` | the built screens |
| `/v1/userinfo` | profile for a bearer token |
| `/tokeninfo`, `/revoke` | token introspection / revocation |
| `/__idp/*` | test-only control plane (seed, reset, faults) |

As Apple it serves `/auth/authorize`, `/auth/token`, `/auth/keys` and
`/auth/revoke` (plus the same discovery, screens and `/__idp/*`).

Because it speaks the real protocol, the relying party runs its **production**
code path against it: PKCE S256, exact `redirect_uri` matching, single-use
authorization codes (a replay kills the grant, as Google does), client
authentication via `client_secret_post` or Basic, RS256 `id_token`s with
`at_hash`/`azp`/`nonce`.

## Apple's quirks, on purpose

Apple is where relying parties break, so the Apple flavor reproduces what
Apple actually does rather than what a generic OIDC server would:

- **`response_mode=form_post`.** With `name`/`email` scopes Apple POSTs the
  code back from an auto-submitting HTML form instead of redirecting. The
  mock does too (and still accepts `query` / `fragment` without scopes).
- **The user's name is sent once.** The `user` JSON (name, email) rides the
  *first* authorization only; every later sign-in carries just the
  `id_token`. Revoking the grant makes the next sign-in "first" again.
- **Hide My Email.** The consent card asks "Share My Email" / "Hide My Email".
  Hiding yields a relay address `@privaterelay.appleid.com`, stable per
  account and team, with `is_private_email: true` — never the real address.
- **The client secret is a JWT.** The relying party signs an ES256 client
  secret (`iss` team id, `sub` client id, `aud https://appleid.apple.com`,
  at most six months) with its key; the mock verifies it against the public
  half registered on the Services ID (`IdpAppleClient.publicJwk`).
  `createAppleClientKeys()` mints a pair the way Apple's developer portal does.
- **Apple's `sub`** is team-scoped `000123.<32 hex>.4567`; `real_user_status`
  and `nonce_supported` are in the token; the share / hide choice sticks to
  the grant, so later sign-ins keep the same address.
- **Server-to-server notifications.** `/__idp/events` makes the mock POST a
  signed `{ payload: <JWT> }` to the Services ID's notification URL, whose
  `events` claim is itself a JSON *string*, as Apple sends it:
  `consent-revoked`, `account-delete`, `email-disabled`, `email-enabled`.
- **Key rotation.** `/__idp/keys/rotate` publishes a new signing key; a
  relying party that caches JWKS must refetch on an unknown `kid`.

Faults (below) add the rest: string-boolean claims (`"true"`), a skewed or
stale `id_token`, a token signed with an unpublished key.

Sign in with Apple is **mock-only** in this product: the Worker refuses the
`APPLE_*` bindings when `SECRETS_ENV=prd`.

## Google's wire, its own face

The **protocol** is Google's, down to the `sub` shape and the `4/0A…` code
format, because that is the whole point: the relying party runs its production
`google-oauth` path against this server.

The **screens** are not. They say `OAuth Mock`, with their own mark and wordmark
(`src/shared/brand.ts`), built from the product design system. Cloning
Google's sign-in and inventing a plausible brand fail the same way: someone
opens the simulator and cannot tell whether it is real. This one says what it
is, in the wordmark, the page titles and the footer.

Saying "mock" is not licence to be a toy. The flow mirrors real social sign-in
step for step — address, account chooser, password, consent with scopes,
account creation, refusal — so every path a relying party must handle is still
reachable; only the identity is honest.

Renaming the brand is one edit to `IDP_BRAND` in `src/shared/brand.ts`; the
screens, page titles, server error copy and favicon all read from it.

**All state is SQLite.** There is no map-backed mode: accounts, clients,
browser sessions, parked authorize requests, codes, tokens, consent grants,
fault flags and the RS256 key live in one database the caller opens. Every
multi-row change (authorize submission, code redemption, reset) is one
transaction, and expired rows are swept before reads that depend on them.

```ts
// In-process, on a virtual clock, as one node of a simulation.
const store = await IdpStore.open({ sqlClient, clock, createId, createKeys });
const idp = await createIdpSimApp({ store, clients, accounts });

// Standalone, on its own OS-assigned loopback port, with its own state.
const handle = await startIdpSimServer({ port: 0, clients });
```

`IdpStore.open` migrates the schema, seeds nothing, and mints (or re-imports)
the signing key — so a file-backed store keeps the same `kid`/JWKS across
restarts. Standalone durability is an explicit choice:

| `state` | database | survives |
| --- | --- | --- |
| `{ kind: 'memory' }` (default) | in-memory SQLite | nothing |
| `{ kind: 'file', path }` | that file | restarts |

`bun run stack` resolves `--idp-state memory\|instance\|path` to one of those.

Every account authenticates with the literal password `password`
(`IDP_PASSWORD`); there is no per-account secret. `defaultAccountsFor(provider)`
seeds Google with `alice` … `fred` at `gmail.com`, a Workspace account
(`wendy`, `hd`) and one whose address Google never verified (`uma`), and Apple
with `alice` / `bob` at `icloud.com` plus `chris@gmail.com` (the same person as
Google's `chris` — the account-linking case). New accounts are created from the
sign-in or chooser screen — name and email, no password field.

The screens are a **Solid SPA** (`web/`, Vite root `web/index.html`) with stable
`data-testid`s (`IDP_TEST_IDS`), so a browser test and a headless walk drive the
same flow. Sign-in is Google's two steps — `identifier`, then `password` — with
the account chooser, the create-account card and the consent card around them.
Every control is a `@pkgs/ui` component — `Card`, `TextInput`, `Button`,
`Checkbox`, `MenuRow`, `Avatar`, `Notice`, `TextLink`, `IconLink` and its icons
— under `ThemeProvider`, so the screens follow the design system's tokens and
light / dark scheme (`web/src/styles.css` compiles Tailwind over `@pkgs/ui`'s
sources). Only the `OAuth Mock` mark and wordmark are the provider's own.

Both hosts render **one** component tree: `src/server/render/render-screen.tsx`
renders `web/src/screen.tsx` into a DOM (happy-dom, registered by
`@pkgs/bun-test-solid/register`) and reads back `innerHTML`, while a real browser mounts
the same tree as an SPA. The server owns the shell: the built CSS is inlined
and the built JS is served from `/idp-assets/app.js` out of the committed
bundle (`src/server/assets.generated.ts`, produced by
`bun run --filter @pkgs/idp-sim build:web`). Step transitions are typed
Hono RPC (`/rpc/*`, `hc<IdpAppType>`); the HTML `POST` target stays
`/o/oauth2/v2/auth/submit` so a browser without JavaScript — and every headless
walker — takes the same path.

Bun hosts that render a screen need the same compile contract:
`bun --conditions=browser --conditions=development --preload
@pkgs/bun-test-solid/register` (`bun run stack` and this package's `start`;
`bun test` in this package, `@pkgs/auth` and `@pkgs/auth-sim` preload
`@pkgs/bun-test-solid/preload`, which includes it).

Navigation is Google's: a back arrow on every screen that is not the first step
(`/o/oauth2/v2/auth/back?request_id=…` returns to the account picker, or the
address step when the browser knows no accounts), "Use another account" on the
chooser, and "Sign in instead" on the create screen. The address step offers a
`<datalist>` of known addresses plus `autocomplete`/`inputmode` hints; the
datalist sits outside the form so the relying party's headless form walker
still sees exactly one form. The password step keeps its own GET URL
(`/o/oauth2/v2/auth/password?request_id=…`) so a refresh or a back button is a
normal page load.

Faults are first class (`IdpFaults`, `POST /__idp/faults`): a failing token
endpoint, a 500 from userinfo, a withheld refresh token, a user who cancels at
the consent screen, boolean claims sent as strings, a skewed `id_token` clock,
a token signed with a key the JWKS does not publish. Those are the provider
behaviours that are impossible to provoke on demand and therefore the ones
relying parties get wrong. The control plane also revokes grants
(`/__idp/grants/revoke`), deletes accounts (`DELETE /__idp/accounts/:sub`,
which for Apple also sends `account-delete`), sends Apple events and rotates
keys.
