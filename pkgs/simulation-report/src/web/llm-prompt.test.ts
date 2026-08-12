import { describe, expect, test } from 'bun:test';

import type { SimulationReportData } from '../types';
import {
  createMutableUiAttribution,
  freezeUiAttribution,
  mergeFrameHtmlAttribution,
} from '../writer/ui-attribution';
import { buildLlmPrompt } from './llm-prompt';

const sampleData = (): SimulationReportData => ({
  meta: {
    seed: 'seed-1',
    ui: 'in-process',
    startedAtMs: 1_000,
    endedAtMs: 1_500,
    durationMs: 500,
    status: 'passed',
    actorIds: ['player'],
    runId: '20240101T000000',
    testId: 'auth-login',
    sourceFile: 'test/ui/src/scenarios/auth-login.sim.test.tsx',
    uiAttribution: {
      components: { Button: 2, Text: 1 },
      sources: {
        'pkgs/ui/src/components/button/button.tsx:10': {
          count: 2,
          components: ['Button'],
        },
      },
    },
  },
  steps: [
    {
      index: 1,
      kind: 'tap',
      title: 'tap submit',
      status: 'passed',
      actorId: 'player',
      startedAtMs: 1_000,
      endedAtMs: 1_200,
      durationMs: 200,
      frames: [
        {
          file: 'step-001-frame-001.html',
          capturedAtMs: 1_100,
          durationMs: 50,
        },
      ],
    },
    {
      index: 2,
      kind: 'waitFor',
      title: 'wait for home',
      status: 'passed',
      actorId: 'player',
      startedAtMs: 1_200,
      endedAtMs: 1_500,
      durationMs: 300,
      selector: '[data-testid="home"]',
      frames: [
        {
          file: 'step-002-frame-001.html',
          capturedAtMs: 1_400,
          durationMs: 80,
        },
      ],
    },
  ],
});

describe('ui attribution merge', () => {
  test('counts components and associates sources', () => {
    const acc = createMutableUiAttribution();
    mergeFrameHtmlAttribution(
      acc,
      '<div data-component="Button" data-src="a.tsx:1"></div><span data-component="Text" data-src="b.tsx:2"></span><button data-component="Button" data-src="a.tsx:1"></button>'
    );
    const frozen = freezeUiAttribution(acc);
    expect(frozen.components).toEqual({ Button: 2, Text: 1 });
    expect(frozen.sources['a.tsx:1']).toEqual({
      count: 2,
      components: ['Button'],
    });
    expect(frozen.sources['b.tsx:2']).toEqual({
      count: 1,
      components: ['Text'],
    });
  });
});

describe('buildLlmPrompt', () => {
  test('includes selection, slow steps, paths, and attribution without HTML', () => {
    const prompt = buildLlmPrompt({
      data: sampleData(),
      bucketId: 'local',
      runId: '20240101T000000',
      selectedFrameIdx: 1,
      playheadIdx: 1,
      previewIdx: 1,
      viewerOrigin: 'http://127.0.0.1:7789',
    });
    expect(prompt).toContain(
      'sourceFile: test/ui/src/scenarios/auth-login.sim.test.tsx'
    );
    expect(prompt).toContain('selected frame: #2');
    expect(prompt).toContain('wait for home');
    expect(prompt).toContain('## Slow steps (by duration)');
    expect(prompt).toContain('#2 waitFor');
    expect(prompt).toContain('Button: 2');
    expect(prompt).toContain('pkgs/ui/src/components/button/button.tsx:10');
    expect(prompt).toContain(
      'simulation-report-data/runs/20240101T000000/tests/auth-login/step-002-frame-001.html'
    );
    expect(prompt).toContain('/b/local/r/20240101T000000/t/auth-login');
    expect(prompt).not.toContain('```html');
    expect(prompt).not.toContain('Selected frame HTML');
    expect(prompt).not.toContain('data-component="Button"');
  });
});
