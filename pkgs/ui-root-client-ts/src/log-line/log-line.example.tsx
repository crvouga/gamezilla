/** @jsxImportSource solid-js */

import { LogLine } from '@pkgs/ui-root-client-ts/log-line';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

export default function LogLineExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Every level, newest first">
        <StackVertical>
          <LogLine
            level="error"
            time="12:04:05.120"
            message="POST /api/mutations 500 (room closed)"
          />
          <LogLine
            level="warn"
            time="12:04:04.981"
            message="clock skew 240 ms"
          />
          <LogLine
            level="info"
            time="12:04:04.002"
            message="GET /api/query 200"
          />
          <LogLine
            level="debug"
            time="12:04:03.770"
            message="subscribe user:alice"
          />
        </StackVertical>
      </ExampleSection>
    </ExampleRoot>
  );
}
