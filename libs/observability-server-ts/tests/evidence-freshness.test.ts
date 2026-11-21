import { describe, expect, test } from 'bun:test';
import {
  EVIDENCE_SOURCES,
  evidenceFreshnessRules,
  freshnessIssues,
  quietExpression,
} from '@libs/observability-server-ts/evidence-freshness';
import { metricBackedSlos } from '@libs/observability-server-ts/slo-alerts';
import { ruleIssues } from '@libs/observability-server-ts/slo-checks';
import { metricIndicators } from '@libs/observability-server-ts/slo-indicators';
import { objectiveFiles } from './specs';

const docs = () => objectiveFiles().map((file) => file.doc);
const rules = () => evidenceFreshnessRules(docs());

describe('the evidence-freshness rules', () => {
  test('watch every indicator the team schedules, and none that people cause', () => {
    expect(freshnessIssues()).toEqual([]);
    const scheduled = metricIndicators().filter(
      (i) => i.evidence === 'schedule'
    );
    expect(scheduled.map((i) => i.sli)).toContain('game-journeys-passing');
    expect(scheduled.map((i) => i.sli)).toContain('outside-pings-answered');
    expect(scheduled.map((i) => i.sli)).toContain('background-runs-completing');
  });

  // regression: slo-unjudged-objective-is-silent
  test('cover every objective whose evidence is scheduled', () => {
    const covered = new Set(rules().flatMap((r) => r.covers.split(',')));
    const scheduledSlos = metricBackedSlos(docs()).filter((slo) =>
      metricIndicators().some(
        (i) => i.sli === slo.indicator && i.evidence === 'schedule'
      )
    );
    expect(scheduledSlos.length).toBeGreaterThan(0);
    for (const slo of scheduledSlos) expect(covered).toContain(slo.name);
    expect(covered).not.toContain('the-app-serves-people');
  });

  test('push, then page later, and only in production', () => {
    expect(rules()).toHaveLength(EVIDENCE_SOURCES.length * 2);
    for (const source of EVIDENCE_SOURCES) {
      const own = rules().filter((r) => r.name.endsWith(source.what));
      expect(own.map((r) => r.route).sort()).toEqual(['page', 'push']);
    }
    for (const rule of rules()) expect(rule.production_only).toBe(true);
  });

  test('carry everything a rule needs to be acted on', () => {
    expect(ruleIssues(rules())).toEqual([]);
  });

  test('name the one check that stopped, but not a check never run there', () => {
    const health = EVIDENCE_SOURCES.find((s) => s.key === 'health-checks');
    if (health === undefined) throw new Error('no health-checks source');
    const expr = quietExpression(health, '6h');
    expect(expr).toContain('count by (app_synthetic_check)');
    expect(expr).toContain('[3d])) unless');
    expect(expr).toContain('or absent_over_time(');
  });
});
