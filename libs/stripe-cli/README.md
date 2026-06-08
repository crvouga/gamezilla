# `@libs/stripe-cli`

Runs `bun x stripe listen` against your local API (`API_URL` from Vault `dev`), forwards Stripe webhooks to `${API_URL}/stripe/webhook`, and writes the CLI signing secret to Vault as `STRIPE_WEBHOOK_SECRET`. After the first `whsec_…` line appears, it POSTs a **signed** synthetic `customer.created` event to `/stripe/webhook` (with retries) to confirm the API accepts the same secret Vault now has. If that probe still fails, the process **exits with code 1** and stops `stripe listen` so a misconfigured API fails fast in `turbo dev`.

**Requirements:** Vault config `dev`, `STRIPE_SECRET_KEY` + `API_URL` in Vault, Stripe CLI install (`brew install stripe/stripe-cli/stripe`), `@apps/api` dev server up (script waits on `/health`).

**Commands:**

- From repo root: `bun run stripe:listen` or `bun run dev` (turbo includes this package).
- From this package: `bun run dev`.
