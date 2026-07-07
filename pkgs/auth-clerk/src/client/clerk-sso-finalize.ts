type SsoFlowResult = {
  readonly createdSessionId: string | null;
  readonly setActive?: (params: { session: string }) => Promise<void>;
  readonly signIn?: {
    readonly existingSession?: { readonly sessionId: string } | null;
    readonly createdSessionId?: string | null;
    readonly status?: string | null;
  };
  readonly signUp?: {
    readonly existingSession?: { readonly sessionId: string } | null;
    readonly createdSessionId?: string | null;
    readonly status?: string | null;
  };
};

function readNonEmptySessionId(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value.length === 0) return null;
  return value;
}

function readExistingSessionId(result: SsoFlowResult): string | null {
  return (
    readNonEmptySessionId(result.signIn?.existingSession?.sessionId) ??
    readNonEmptySessionId(result.signUp?.existingSession?.sessionId)
  );
}

function readCompletedSessionId(result: SsoFlowResult): string | null {
  const direct = readNonEmptySessionId(result.createdSessionId);
  if (direct !== null) return direct;

  if (result.signIn?.status === 'complete') {
    const fromSignIn = readNonEmptySessionId(result.signIn.createdSessionId);
    if (fromSignIn !== null) return fromSignIn;
  }

  if (result.signUp?.status === 'complete') {
    const fromSignUp = readNonEmptySessionId(result.signUp.createdSessionId);
    if (fromSignUp !== null) return fromSignUp;
  }

  return readExistingSessionId(result);
}

export async function finalizeClerkSsoFlowResult(
  result: SsoFlowResult
): Promise<void> {
  const sessionId = readCompletedSessionId(result);
  if (sessionId === null || result.setActive === undefined) return;
  await result.setActive({ session: sessionId });
}
