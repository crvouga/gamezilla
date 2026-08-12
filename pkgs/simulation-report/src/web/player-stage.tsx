import type { FlatFrame } from './frames';
import { SnapshotStage } from './snapshot-stage';
import { styles } from './theme';

export function PlayerStage(props: {
  readonly previewFrame: FlatFrame | null;
  readonly previewSrc: string | null;
  readonly showInteractionOverlay?: boolean;
}) {
  const { previewFrame, previewSrc, showInteractionOverlay = false } = props;
  const step = previewFrame?.step;

  return (
    <section style={styles.detail}>
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
