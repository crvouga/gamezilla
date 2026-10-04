# `@pkgs/auth`

The auth abstraction: everything the product asks of an auth service, and
nothing about how any one service answers. The product signs people in
through this port and never learns which service is behind it.

```
@pkgs/auth                ports + vocabulary + contract suite  (this package)
@pkgs/auth-inhouse        the in-house IdP — one adapter       (today's service)
@pkgs/auth-<vendor>       Clerk, Firebase Auth, WorkOS, …      (a sibling adapter)
```

## Entrypoints

| Import | What |
| --- | --- |
| `@pkgs/auth/shared` | Vocabulary: `OauthProviderId` (`google` / `apple`), `AuthIdentity`, `AuthUser`, `VerifiedSession`, `AUTH_ERROR` codes. |
| `@pkgs/auth/client` | `AuthClientPort` (sign in / out, link / unlink, bearer tokens, reactive `session`), `AuthFlowError`, `AuthLinkRequiredError`. |
| `@pkgs/auth/server` | `AuthServerPort` (`verifySessionToken`, `getUser`), and `AuthProviderModule` — what a composition root builds. |
| `@pkgs/auth/contract` | `describeAuthServerContract`: the suite every server adapter passes. |

## How the product uses it

- **API.** `@libs/runtime/root/server/app-auth-provider.ts` names the one
  `AuthProviderModule`. The Worker hands it to `createServer` as
  `ServerEnv.auth`. The server builds it from the deployment's secrets
  (`readSecret`) and the API's coordinates, then keeps three things:
  - `server`: the `AuthServerPort` that `SessionAuth` verifies bearers with;
  - `signInMethods`: which buttons the sign-in UI shows (via `client_config`);
  - `handler`: endpoints the service answers on the API origin (the in-house
    IdP's `/api/auth/*`). A hosted service leaves this out.

  Reconcile calls `reconcilePostgres` when the service keeps tables in the
  product's database.
- **Accounts.** `@libs/auth` maps each `(provider, externalUserId)` onto a
  product `users.id` (`auth_external_accounts`), upgrading the install's
  anonymous user on first sign-in. It mirrors `getUser().identities` into
  synced rows for the account screen. None of this depends on the service.
- **Client.** The wall and harness `ClientEnv`s supply
  `createAuthClient: () => AuthClientPort`. `AppAuthProvider` puts it in
  context; every hook and screen talks to the port.

Product code importing an adapter package or a vendor SDK fails `lint`
(`libs/tools/biome-plugins/import-auth-vendor.grit`). Only composition roots,
harnesses, scripts and tests may.

## Adding another service (Clerk, Firebase Auth, WorkOS, Cognito, Better Auth)

1. Create `pkgs/auth-<vendor>` exporting:
   - `<VENDOR>_AUTH_PROVIDER: AuthProviderModule`. `create(env)` reads its
     keys with `env.readSecret`, and throws `AuthProviderConfigError` when
     they are missing or partial. `server.verifySessionToken` verifies the
     vendor's session JWT; `getUser` maps the vendor's user and its
     connected accounts onto `AuthUser` / `AuthIdentity`. Omit `handler`
     unless the vendor posts webhooks to the API origin. Omit
     `reconcilePostgres`.
   - a client factory returning `AuthClientPort`. `signIn(provider)` starts
     the vendor's OAuth flow for that `OauthProviderId`. `getFreshToken`
     returns a token the server adapter verifies. `session` wraps the SDK's
     session listener. Map the vendor's errors onto `AuthFlowError` codes,
     and throw `AuthLinkRequiredError` if the vendor surfaces an
     account-transfer step (otherwise never).
2. Run `describeAuthServerContract('<vendor>', openHarness)` from its tests.
3. Point `APP_AUTH_PROVIDER` and the wall `ClientEnv.createAuthClient` at it.
   Add its secrets to the registry in `@libs/secrets`.
4. Existing users keep their product accounts through
   `auth_external_accounts`. To move them, link each user's new
   `(provider, externalUserId)` to the same `users.id`.
