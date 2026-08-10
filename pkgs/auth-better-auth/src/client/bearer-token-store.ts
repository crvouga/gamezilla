import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BEARER_STORAGE_KEY = 'gamezilla.better-auth.bearer';

/**
 * `undefined` = not hydrated from disk yet; `null` = known empty / cleared.
 * Distinguishes "cleared on purpose" from "not loaded" so peek cannot
 * rehydrate a just-cleared token from localStorage mid-await.
 */
let memoryToken: string | null | undefined = undefined;
/** Blocks disk rehydrate after sign-out / OAuth handoff clears. */
let explicitlyCleared = false;
/** While true, ignore `set-auth-token` (sign-out session refetch race). */
let suppressBearerCapture = false;

function syncReadWebLocalStorage(): string | null {
  if (Platform.OS !== 'web') return null;
  try {
    const stored = globalThis.localStorage?.getItem(BEARER_STORAGE_KEY) ?? null;
    if (stored === null || stored.trim().length === 0) return null;
    return stored.trim();
  } catch {
    return null;
  }
}

/** Synchronous peek (web also checks localStorage for E2E / reload). */
export function peekBearerToken(): string | null {
  if (explicitlyCleared) return null;
  if (memoryToken !== undefined) return memoryToken;
  const fromWeb = syncReadWebLocalStorage();
  if (fromWeb !== null) {
    memoryToken = fromWeb;
    return fromWeb;
  }
  memoryToken = null;
  return null;
}

async function readPersisted(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      const stored =
        globalThis.localStorage?.getItem(BEARER_STORAGE_KEY) ?? null;
      if (stored === null || stored.trim().length === 0) return null;
      return stored.trim();
    } catch {
      return null;
    }
  }
  try {
    const stored = await SecureStore.getItemAsync(BEARER_STORAGE_KEY);
    if (stored === null || stored.trim().length === 0) return null;
    return stored.trim();
  } catch {
    return null;
  }
}

async function writePersisted(token: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (token === null) {
        globalThis.localStorage?.removeItem(BEARER_STORAGE_KEY);
      } else {
        globalThis.localStorage?.setItem(BEARER_STORAGE_KEY, token);
      }
    } catch {
      // ignore
    }
    return;
  }
  try {
    if (token === null) {
      await SecureStore.deleteItemAsync(BEARER_STORAGE_KEY);
    } else {
      await SecureStore.setItemAsync(BEARER_STORAGE_KEY, token);
    }
  } catch {
    // ignore
  }
}

export async function readStoredBearerToken(): Promise<string | null> {
  if (explicitlyCleared) return null;
  if (memoryToken !== undefined) return memoryToken;
  const stored = await readPersisted();
  // Sign-out may clear while SecureStore read is in flight.
  if (explicitlyCleared) return null;
  memoryToken = stored;
  return stored;
}

export async function writeStoredBearerToken(token: string): Promise<void> {
  const trimmed = token.trim();
  explicitlyCleared = false;
  memoryToken = trimmed.length > 0 ? trimmed : null;
  await writePersisted(memoryToken);
}

export async function clearStoredBearerToken(): Promise<void> {
  clearStoredBearerTokenSync();
  // Web localStorage already removed synchronously; native needs SecureStore.
  if (Platform.OS !== 'web') {
    await writePersisted(null);
  }
}

/**
 * Drop bearer from memory + web localStorage immediately (no await). Use on
 * OAuth return / sign-out before any get-session so a stale Authorization
 * header cannot overwrite session cookies inside Better Auth's bearer() hook.
 */
export function clearStoredBearerTokenSync(): void {
  explicitlyCleared = true;
  memoryToken = null;
  if (Platform.OS !== 'web') return;
  try {
    globalThis.localStorage?.removeItem(BEARER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Block capturing `set-auth-token` during sign-out refetch races. */
export function setSuppressBearerCapture(suppress: boolean): void {
  suppressBearerCapture = suppress;
}

/** Capture `set-auth-token` from Better Auth bearer plugin responses. */
export function captureBearerFromResponse(response: Response): void {
  if (suppressBearerCapture) return;
  const token = response.headers.get('set-auth-token')?.trim() ?? '';
  if (token.length === 0) return;
  explicitlyCleared = false;
  memoryToken = token;
  void writeStoredBearerToken(token);
}

/** Storage key used by Playwright E2E token injection (web localStorage). */
export const BETTER_AUTH_BEARER_STORAGE_KEY = BEARER_STORAGE_KEY;
