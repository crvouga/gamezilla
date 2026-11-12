/**
 * What a failed objective or firing alert policy leaves behind for whoever
 * answers it: where it failed (the environment and the objective file), the
 * numbers, and the response the binding gives (owner, runbook, the command
 * that starts the investigation). The bun:test bridge writes one per failed
 * check and puts {@link failureWhere} in front of every failure message, so a
 * log that checks several environments never leaves the reader guessing
 * which one failed.
 */

import type { AlertResponse } from './registry';

/** One burn-rate condition's reading, as a firing policy saw it. */
export type BurnReading = {
  readonly lookbackWindow: string;
  /** Times faster than the objective allows; `null` when nothing was counted. */
  readonly burn: number | null;
  /** The burn rate the condition fires at. */
  readonly threshold: number;
  readonly events: number;
};

export type FailedCheck =
  | { readonly kind: 'objective'; readonly objective: string }
  | {
      readonly kind: 'alert';
      readonly policy: string;
      /** The condition's severity (`page`, `ticket`). */
      readonly severity: string;
    };

export type ObjectiveFailure = {
  /** The environment the objective was measured in, or `null` when the run named none. */
  readonly environment: string | null;
  /** Repo-relative objective file (`specs/runtime/request-success.openslo.yaml`). */
  readonly specUri: string;
  readonly slo: string;
  readonly sloDisplayName: string | null;
  readonly sloDescription: string | null;
  readonly check: FailedCheck;
  /** The objective's time window (`28d`). */
  readonly window: string;
  /** The objective's target as a fraction. */
  readonly target: number | null;
  /** good / total over the window, when measured. */
  readonly observed: number | null;
  /** Events or samples the verdict considered. */
  readonly considered: number | null;
  readonly readings: readonly BurnReading[];
  /** Share of the window's error budget still left, when known. */
  readonly budgetRemaining: number | null;
  /** Who answers it and how; absent when the binding gives no response. */
  readonly response: AlertResponse | null;
  /** The verdict in words, as the failing test reports it. */
  readonly detail: string;
};

/** `[prd] specs/runtime/request-success.openslo.yaml` — the prefix of every failure message. */
export function failureWhere(
  environment: string | null | undefined,
  specUri: string
): string {
  return environment === null || environment === undefined || environment === ''
    ? specUri
    : `[${environment}] ${specUri}`;
}

/** ` Owner: runtime. Runbook: <url>. Investigate with: <command>` — empty without a response. */
export function responseText(response: AlertResponse | null): string {
  if (response === null) return '';
  return ` Owner: ${response.owner}. Runbook: ${response.runbook}. Investigate with: ${response.command}`;
}

/** The message a failed check fails its test with. */
export function failureMessage(failure: ObjectiveFailure): string {
  const where = failureWhere(failure.environment, failure.specUri);
  if (failure.check.kind === 'alert') return `${where}: ${failure.detail}`;
  return `${where}: ${failure.slo} does not meet "${failure.check.objective}": ${failure.detail}.${responseText(failure.response)}`;
}

/** The evidence obligation a failure belongs to (`objective:<slo>:<name>`, `alert:<slo>:<policy>`). */
export function failureId(failure: ObjectiveFailure): string {
  return failure.check.kind === 'objective'
    ? `objective:${failure.slo}:${failure.check.objective}`
    : `alert:${failure.slo}:${failure.check.policy}`;
}

export function isObjectiveFailure(value: unknown): value is ObjectiveFailure {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const check = v['check'] as Record<string, unknown> | null | undefined;
  return (
    typeof v['specUri'] === 'string' &&
    typeof v['slo'] === 'string' &&
    typeof v['window'] === 'string' &&
    typeof v['detail'] === 'string' &&
    Array.isArray(v['readings']) &&
    typeof check === 'object' &&
    check !== null &&
    (check['kind'] === 'objective' || check['kind'] === 'alert')
  );
}
