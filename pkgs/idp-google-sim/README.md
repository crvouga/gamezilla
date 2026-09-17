# `@pkgs/idp-google-sim`

A **simulated Google identity provider** — not a stub.

It owns its own account directory, browser sessions, consent grants, signing
keys and tokens, and it serves Google's documented endpoints:

| Path | Purpose |
| --- | --- |
| `/.well-known/openid-configuration` | discovery |
| `/oauth2/v3/certs` | JWKS for `id_token` verification |
| `/o/oauth2/v2/auth` | authorize — account chooser, password, consent |
| `/token` | `authorization_code` + `refresh_token` grants |
| `/v1/userinfo` | profile for a bearer token |
| `/tokeninfo`, `/revoke` | token introspection / revocation |
| `/__idp/*` | test-only control plane (seed, reset, faults) |

Because it speaks the real protocol, the relying party runs its **production**
code path against it: PKCE S256, exact `redirect_uri` matching, single-use
authorization codes (a replay kills the grant, as Google does), client
authentication via `client_secret_post` or Basic, RS256 `id_token`s with
`at_hash`/`azp`/`nonce`.

Two ways to run it:

```ts
// In-process, on a virtual clock, as one node of a simulation.
const idp = createGoogleIdpApp({ clock, createId, keys, clients, accounts });

// Standalone, on its own OS-assigned loopback port, with its own state.
const handle = await startGoogleIdpServer({ port: 0, clients });
```

The screens are real HTML with stable `data-testid`s (`IDP_TEST_IDS`), so a
browser test and a headless walk drive the same flow.

Faults are first class (`IdpFaults`): a failing token endpoint, a 500 from
userinfo, a withheld refresh token, a user who cancels at the consent screen.
Those are the Google behaviours that are impossible to provoke on demand and
therefore the ones relying parties get wrong.
