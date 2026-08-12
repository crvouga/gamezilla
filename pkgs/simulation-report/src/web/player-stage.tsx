import type { FlatFrame } from './frames';
import { formatMs } from './frames';
import { SnapshotStage } from './snapshot-stage';
import { merge, styles } from './theme';

export function PlayerStage(props: {
  readonly previewFrame: FlatFrame | null;
  readonly previewSrc: string | null;
  readonly showInteractionOverlay?: boolean;
}) {
  const { previewFrame, previewSrc, showInteractionOverlay = false } = props;
  const step = previewFrame?.step;
  const metaParts = step
    ? [
        step.actorId,
        step.kind,
        step.status,
        formatMs(previewFrame?.durationMs),
        step.selector,
        step.detail,
      ].filter(Boolean)
    : null;
  const metaLine = metaParts ? metaParts.join(' · ') : null;

  return (
    <section style={styles.detail}>
      <div style={styles.detailMeta}>
        {step ? (
          <>
            <h2 style={styles.detailH2}>{step.title}</h2>
            <div style={styles.detailMetaLine}>{metaLine}</div>
            {step.error ? (
              <div style={styles.metaError}>{step.error}</div>
            ) : null}
          </>
        ) : (
          <div style={merge(styles.empty, { padding: 0 })}>Select a frame</div>
        )}
      </div>
      <div style={styles.preview}>
        <SnapshotStage
          src={previewSrc}
          interactionStep={
            showInteractionOverlay && step
              ? {
                  kind: step.kind,
                  ...(step.selector !== undefined
                    ? { selector: step.selector }
                    : {}),
                  ...(step.detail !== undefined ? { detail: step.detail } : {}),
                }
              : null
          }
        />
      </div>
    </section>
  );
}
