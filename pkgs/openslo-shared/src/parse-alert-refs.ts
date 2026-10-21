/**
 * Alerting references, checked once every document of a file is read: a
 * policy's conditions and targets, an SLO's policies, and whether each
 * condition fits the SLO that uses it (it cannot average over more time than
 * the SLO's window, nor wait longer than it looks back).
 */

import type { AlertCondition, AlertPolicy, OpenSloDoc, Slo } from './model';
import { parseDuration } from './window';

export function checkAlertReferences(issues: string[], doc: OpenSloDoc): void {
  const conditions = new Map(doc.alertConditions.map((c) => [c.name, c]));
  const targets = new Set(doc.alertNotificationTargets.map((t) => t.name));
  const policies = new Map(doc.alertPolicies.map((p) => [p.name, p]));
  for (const policy of doc.alertPolicies) {
    issues.push(...policyReferenceIssues(policy, conditions, targets));
  }
  for (const slo of doc.slos) {
    for (const name of slo.alertPolicies) {
      const policy = policies.get(name);
      if (policy === undefined) {
        issues.push(
          `SLO ${slo.name}: alertPolicyRef "${name}" names no AlertPolicy in this file`
        );
        continue;
      }
      for (const conditionName of policy.conditions) {
        const condition = conditions.get(conditionName);
        if (condition === undefined) continue;
        issues.push(
          ...conditionFitIssues(
            `SLO ${slo.name} policy ${name} condition ${conditionName}`,
            slo,
            condition
          )
        );
      }
    }
  }
}

function policyReferenceIssues(
  policy: AlertPolicy,
  conditions: ReadonlyMap<string, AlertCondition>,
  targets: ReadonlySet<string>
): readonly string[] {
  const missingConditions = policy.conditions
    .filter((name) => !conditions.has(name))
    .map(
      (name) =>
        `AlertPolicy ${policy.name}: conditionRef "${name}" names no AlertCondition in this file`
    );
  const missingTargets = policy.notificationTargets
    .filter((name) => !targets.has(name))
    .map(
      (name) =>
        `AlertPolicy ${policy.name}: targetRef "${name}" names no AlertNotificationTarget in this file`
    );
  return [...missingConditions, ...missingTargets];
}

function conditionFitIssues(
  where: string,
  slo: Slo,
  condition: AlertCondition
): readonly string[] {
  const windowMs = parseDuration(slo.timeWindow.duration) ?? 0;
  const lookbackMs = parseDuration(condition.lookbackWindow) ?? 0;
  const afterMs =
    condition.alertAfter === null
      ? 0
      : (parseDuration(condition.alertAfter) ?? 0);
  const issues: string[] = [];
  if (lookbackMs > windowMs) {
    issues.push(
      `${where}: lookbackWindow ${condition.lookbackWindow} is longer than the SLO's ${slo.timeWindow.duration} window`
    );
  }
  if (afterMs > lookbackMs) {
    issues.push(
      `${where}: alertAfter ${String(condition.alertAfter)} is longer than lookbackWindow ${condition.lookbackWindow}`
    );
  }
  return issues;
}
