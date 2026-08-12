import type { FlatFrame } from './frames';
import { formatMs } from './frames';
import { SnapshotStage } from './snapshot-stage';

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
    <section className="detail">
      <div className="detail-meta">
        {step ? (
          <>
            <h2 title={step.title}>{step.title}</h2>
            <div className="meta" title={metaLine ?? undefined}>
              {metaLine}
            </div>
            {step.error ? (
              <div className="meta-error" title={step.error}>
                {step.error}
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty">Select a frame</div>
        )}
      </div>
      <div className="preview">
        <SnapshotStage src={previewSrc} />
      </div>
    </section>
  );
}
