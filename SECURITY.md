# Security policy

## Reporting a vulnerability

Report a suspected vulnerability privately. Never open a public issue, pull
request or discussion about it.

- **Preferred:** GitHub private vulnerability reporting, on this repository's
  **Security** tab → **Report a vulnerability**.
- **Or email:** crvouga@gmail.com, with "Security" in the subject. The same
  contact is published as `/.well-known/security.txt` on the production web
  client, `https://www.<domain>` (the domain is `brand.domain` in
  [`product-identity.json`](libs/product-identity/product-identity.json)).

Include what you found, where (a URL, file or commit), how to reproduce it,
and what an attacker could do with it. Do not include real people's data.

## What to expect

- An acknowledgement, and then updates as the report is assessed and fixed.
- Credit in the fix's notes if you want it.
- There is no bug bounty.

## Scope

In scope: the app at `<domain>` and its subdomains, and this
repository (including its CI workflows).

Out of scope: denial-of-service and load testing, social engineering, physical
attacks, and findings in third-party services the app uses (report those to
the vendor).

## Testing rules

Test only against accounts you own. Do not access, change or delete other
people's data, degrade the service for others, or keep data you come across.
Stop and report as soon as you confirm an issue. Good-faith research that
follows these rules will not be pursued.

## Supported versions

Only the current production deployment, built from `main`, is supported.
