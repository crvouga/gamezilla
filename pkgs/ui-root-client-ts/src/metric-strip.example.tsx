import { ExampleRoot } from './example-root';
import { MetricStrip } from './metric-strip';

export default function MetricStripExample() {
  return (
    <ExampleRoot>
      <MetricStrip
        aria-label="Summary"
        metrics={[
          { label: 'Items', value: 128 },
          { label: 'Completed', value: 96 },
          { label: 'Elapsed', value: '2.4 s', detail: 'Recorded duration' },
        ]}
      />
    </ExampleRoot>
  );
}
