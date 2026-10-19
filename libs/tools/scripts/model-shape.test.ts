import { describe, expect, test } from 'bun:test';

import { modelShapeProblems } from './model-shape';
import { specCampaigns } from './spec-campaigns';
import { REPO_ROOT } from './spec-packages';

describe('model shape', () => {
  test('every aggregate handles a lost connection and can be verified', () => {
    // regression: model-shape-campaign-discovery
    const campaigns = new Set(
      specCampaigns(REPO_ROOT).map((campaign) => campaign.domain)
    );
    expect(campaigns.has('system')).toBe(true);
    expect(modelShapeProblems(campaigns)).toEqual([]);
  });
  test('unregistered composed modules still fail aggregate shape verifications', () => {
    expect(modelShapeProblems(new Set())).toContain(
      'specs/system/access-sync.qnt:1: an aggregate needs action init [missing-init]'
    );
  });
});
