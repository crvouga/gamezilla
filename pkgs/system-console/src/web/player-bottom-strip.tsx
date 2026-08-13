import { FrameTimeline } from './frame-timeline';
import type { FlatFrame } from './frames';
import type { PlayMode, PlaySpeed, ReportNavState } from './router';
import { StepScrubMeta } from './step-scrub-meta';
import { styles } from './theme';
import { Transport } from './transport';

type BottomStripActions = {
  readonly selectFrame: (
    frameIdx: number,
    historyMode: 'push' | 'replace'
  ) => void;
  readonly toggleFrame: (frameIdx: number) => void;
  readonly setPlay: (play: boolean) => void;
  readonly setMode: (mode: PlayMode) => void;
  readonly setSpeed: (speed: PlaySpeed) => void;
};

export function PlayerBottomStrip(props: {
  readonly nav: ReportNavState;
  readonly frames: readonly FlatFrame[];
  readonly selectedFrameIdx: number | null;
  readonly hoverFrameIdx: number | null;
  readonly playheadIdx: number;
  readonly previewIdx: number;
  readonly previewFrame: FlatFrame | null;
  readonly holdRemainingMs: number | null;
  readonly actions: BottomStripActions;
  readonly onHover: (idx: number | null) => void;
}) {
  const {
    nav,
    frames,
    selectedFrameIdx,
    hoverFrameIdx,
    playheadIdx,
    previewIdx,
    previewFrame,
    holdRemainingMs,
    actions,
    onHover,
  } = props;
  return (
    <div style={styles.bottomStrip}>
      <div style={styles.bottomStripTop}>
        <Transport
          nav={nav}
          frames={frames}
          previewIdx={previewIdx}
          previewDurationMs={previewFrame?.durationMs}
          onTogglePlay={() => actions.setPlay(!nav.play)}
          onPrev={() =>
            actions.selectFrame(Math.max(0, previewIdx - 1), 'push')
          }
          onNext={() =>
            actions.selectFrame(
              Math.min(frames.length - 1, previewIdx + 1),
              'push'
            )
          }
          onMode={actions.setMode}
          onSpeed={actions.setSpeed}
        />
        <StepScrubMeta frame={previewFrame} />
      </div>
      <FrameTimeline
        frames={frames}
        selectedIdx={selectedFrameIdx}
        hoverIdx={hoverFrameIdx}
        playheadIdx={playheadIdx}
        holdRemainingMs={holdRemainingMs}
        onHover={onHover}
        onSelect={actions.toggleFrame}
      />
    </div>
  );
}
