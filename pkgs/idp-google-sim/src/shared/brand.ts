/**
 * What the mock calls itself.
 *
 * Two rules pull in opposite directions and both matter:
 *
 * 1. **It must not pretend to be a real provider.** Cloning Google's mark and
 *    palette — or inventing a plausible-looking brand like "Acme ID" — both
 *    end the same way: someone opens the simulator and cannot tell whether
 *    they are looking at a real sign-in. So it says `OAuth Mock`, in the
 *    wordmark, the page titles and the footer.
 * 2. **It must still be a high-fidelity mock.** Saying "mock" is not licence
 *    to be a toy: the flow mirrors real social sign-in (Google, Apple) step
 *    for step — address, account chooser, password, consent with scopes,
 *    account creation, refusal — over Google's actual wire, so the relying
 *    party's production code path is the one under test.
 *
 * Honest about what it is, faithful about how it behaves. Everything
 * user-visible reads its name from here.
 */
export const IDP_BRAND = {
  /** Wordmark and the name every screen says out loud. */
  name: 'OAuth Mock',
  /** Sits beside the name in the footer; leaves no room for doubt. */
  tagline: 'Not a real identity provider',
} as const;
