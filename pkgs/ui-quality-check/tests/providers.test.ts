import { expect, test } from 'bun:test';
import { executionProviderCandidates } from 'ui-quality-check';

test('automatic acceleration tries registered CUDA even when its library is separately installed', () => {
  // regression: ui-quality-cuda-not-bundled — literal ONNX Runtime Linux backend metadata.
  expect(
    executionProviderCandidates([
      { name: 'cpu', bundled: true },
      { name: 'cuda', bundled: false },
    ])
  ).toEqual(['cuda', 'cpu']);
  expect(
    executionProviderCandidates([
      { name: 'cpu', bundled: true },
      { name: 'coreml', bundled: true },
      { name: 'webgpu', bundled: true },
    ])
  ).toEqual(['webgpu', 'cpu']);
  expect(
    executionProviderCandidates([{ name: 'cpu', bundled: true }], 'cpu')
  ).toEqual(['cpu']);
});
