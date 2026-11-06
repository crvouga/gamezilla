import {
  planReportRetention,
  pruneReports,
} from '@crvouga/atlas/reports/retention';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { reportsStoreUnconfigured } from './report-store-configuration';

export async function cleanupReportObjects(
  env: Readonly<Record<string, string | undefined>>,
  apply: boolean,
  openStore: () => ObjectStore
) {
  if (reportsStoreUnconfigured(env)) return null;
  const store = openStore();
  return apply ? pruneReports(store) : planReportRetention(store);
}
