import { describe, expect, test } from 'bun:test';
import type { FlatFrame } from '@pkgs/harness-report-shared/frames';
import { stateFrameHtml } from '@pkgs/harness-report-shared/html-frame';
import type {
  ReportFrame,
  ReportStep,
} from '@pkgs/harness-shared/report-types';

function frame(detail: string, kind = 'quint'): FlatFrame {
  const step: ReportStep = {
    index: 0,
    kind,
    title: 'Alice sees the board',
    status: 'passed',
    startedAtMs: 0,
    endedAtMs: 12,
    durationMs: 12,
    detail,
    frames: [],
    steps: [],
  };
  const captured: ReportFrame = {
    index: 0,
    capturedAtMs: 0,
    durationMs: 4,
    snapshots: [],
  };
  return { step, frame: captured, depth: 0, index: 0 };
}

describe('a frame with no UI snapshot', () => {
  test('paints a Quint step as an HTML table, with its durations', () => {
    const html = stateFrameHtml(frame('turn = white\nboard = <a&b>'), []);
    expect(html).toContain('quint · 12ms · frame 4ms');
    expect(html).toContain('<h1>Alice sees the board</h1>');
    expect(html).toContain('<th>turn</th><td>white</td>');
    expect(html).toContain('<th>board</th><td>&lt;a&amp;b&gt;</td>');
    expect(html).not.toContain('<a&b>');
  });

  test('escapes prose that is not a state assignment', () => {
    const html = stateFrameHtml(frame('saw <script>', 'step'), [
      { heading: 'state <json>', body: 'n = 1 & 2' },
    ]);
    expect(html).toContain('<pre>saw &lt;script&gt;</pre>');
    expect(html).toContain('<h2>state &lt;json&gt;</h2>');
    expect(html).toContain('<pre>n = 1 &amp; 2</pre>');
  });
});
