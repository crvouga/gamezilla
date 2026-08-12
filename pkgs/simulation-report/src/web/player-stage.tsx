import type { FlatFrame } from './frames';
import { formatMs } from './frames';
import { SnapshotStage } from './snapshot-stage';
import { merge, styles } from './theme';

export function PlayerStage(props: {
  readonly previewFrame: FlatFrame | null;
  readonly previewSrc: string | null;
}) {
  const { previewFrame, previewSrc } = props;
  const step = previewFrame?.step;
  const metaLine = step
    ? `${step.actorId} · ${step.kind} · ${step.status} · ${formatMs(previewFrame?.durationMs)}`
    : null;

  return (
    <section style={styles.detail}>
      <div style={styles.detailMeta}>
        {step ? (
          <>
            <h2 style={styles.detailH2} title={step.title}>
              {step.title}
            </h2>
            <div style={styles.detailMetaLine} title={metaLine ?? undefined}>
              {metaLine}
            </div>
            {step.error ? (
              <div style={styles.metaError} title={step.error}>
                {step.error}
              </div>
            ) : null}
          </>
        ) : (
          <div style={merge(styles.empty, { padding: 0 })}>Select a frame</div>
        )}
      </div>
      <div style={styles.preview}>
        <SnapshotStage src={previewSrc} />
      </div>
    </section>
  );
}
