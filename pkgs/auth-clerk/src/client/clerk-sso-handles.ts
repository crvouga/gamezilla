/** Structural subset of Clerk's SignIn resource used by browser SSO flows. */
export type ClerkSsoSignInHandle = {
  create: (params: {
    strategy: 'oauth_google';
    redirectUrl: string;
    oidcPrompt?: string;
  }) => Promise<unknown>;
  reload: (params: { rotatingTokenNonce: string }) => Promise<unknown>;
  firstFactorVerification: {
    externalVerificationRedirectURL?: { toString(): string } | null;
    status?: string | null;
  };
  createdSessionId?: string | null;
  existingSession?: { sessionId: string } | null;
  status?: string | null;
};

/** Structural subset of Clerk's SignUp resource used by browser SSO flows. */
export type ClerkSsoSignUpHandle = {
  create: (params: { transfer: boolean }) => Promise<unknown>;
  createdSessionId?: string | null;
  existingSession?: { sessionId: string } | null;
  status?: string | null;
};
