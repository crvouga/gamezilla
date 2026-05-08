/**
 * Portable `(entity_id, entity_type)` multi-match for SQLite across engines
 * (bun:sqlite, native, expo-sqlite web). Row-value `IN (VALUES …)` is brittle
 * on some builds; `OR` chains of scalar comparisons are universally supported.
 */
export function entityIdTypeOrWhere(
  tableAlias: string,
  pairCount: number
): string {
  if (pairCount === 0) return '(1 = 0)';
  const p = tableAlias.length > 0 ? `${tableAlias}.` : '';
  return Array.from(
    { length: pairCount },
    () => `(${p}entity_id = ? AND ${p}entity_type = ?)`
  ).join(' OR ');
}
