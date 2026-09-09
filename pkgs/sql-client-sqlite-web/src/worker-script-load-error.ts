/** Stale deploy / SW cache often serves `index.html` for `/sql-workers/*.js`. */
export function workerScriptLoadError(event: ErrorEvent): Error {
  const raw = (event.message ?? '').trim();
  const hint =
    'SQLite worker failed to load — cached HTML was served instead of JavaScript (stale deploy or site data). Reload the app or clear site data.';
  return new Error(raw.length > 0 ? `${hint} (${raw})` : hint);
}
