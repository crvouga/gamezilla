/**
 * Client-side fetch wrappers around the dev IdP's `/users` CRUD surface.
 * Pure functions — no DOM, no state, no JSX — so they're equally usable
 * from any client component. All error paths return structured failures
 * (no thrown rejects) to keep callers' state machines flat.
 *
 * Shapes match the server router contracts (see
 * `pkgs/dev-idp/src/oauth2-router.ts`); we redeclare them locally
 * because importing the full server types into the browser bundle would
 * pull in `@pkgs/kv` + `pg`.
 */

export type DevIdpUser = {
  readonly sub: string;
  readonly email: string;
  readonly name: string;
  readonly picture: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ListResult =
  | { readonly ok: true; readonly users: readonly DevIdpUser[] }
  | { readonly ok: false; readonly message: string };

export type MutateResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly status: number; readonly message: string };

export async function listUsers(apiPath: string): Promise<ListResult> {
  try {
    const r = await fetch(apiPath, { headers: { accept: 'application/json' } });
    if (!r.ok) {
      return { ok: false, message: `HTTP ${String(r.status)}` };
    }
    const list = (await r.json()) as readonly DevIdpUser[];
    if (!Array.isArray(list)) {
      return { ok: false, message: 'malformed response' };
    }
    return { ok: true, users: list };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function createUser(
  apiPath: string,
  body: { readonly name: string; readonly email: string; readonly picture: string | null }
): Promise<MutateResult> {
  const r = await fetch(apiPath, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) return { ok: false, status: r.status, message: `HTTP ${String(r.status)}` };
  return { ok: true };
}

export async function updateUser(
  apiPath: string,
  sub: string,
  body: {
    readonly name: string;
    readonly email: string;
    readonly picture: string | null;
  }
): Promise<MutateResult> {
  const r = await fetch(`${apiPath}/${encodeURIComponent(sub)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) return { ok: false, status: r.status, message: `HTTP ${String(r.status)}` };
  return { ok: true };
}

export async function deleteUser(
  apiPath: string,
  sub: string
): Promise<MutateResult> {
  const r = await fetch(`${apiPath}/${encodeURIComponent(sub)}`, {
    method: 'DELETE',
  });
  if (!r.ok && r.status !== 404) {
    return { ok: false, status: r.status, message: `HTTP ${String(r.status)}` };
  }
  return { ok: true };
}
