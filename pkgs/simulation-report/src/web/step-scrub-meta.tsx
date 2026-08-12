import type { FlatFrame } from './frames';
import { formatMs } from './frames';
import { merge, styles } from './theme';

/** Step title + meta for the bottom scrub strip (moved out of the HTML pane). */
export function StepScrubMeta(props: { readonly frame: FlatFrame | null }) {
  const step = props.frame?.step;
  if (!step) {
    return (
      <div style={merge(styles.scrubMeta, styles.scrubMetaMuted)}>
        Select a frame
      </div>
    );
  }
  const metaParts = [
    step.actorId,
    step.kind,
    step.status,
    formatMs(props.frame?.durationMs),
    step.selector,
    step.detail,
  ].filter(Boolean);
  return (
    <div style={styles.scrubMeta}>
      <div style={styles.scrubMetaTitle}>{step.title}</div>
      <div style={styles.scrubMetaLine}>{metaParts.join(' · ')}</div>
      {step.error ? (
        <div style={styles.scrubMetaError}>{step.error}</div>
      ) : null}
    </div>
  );
}
