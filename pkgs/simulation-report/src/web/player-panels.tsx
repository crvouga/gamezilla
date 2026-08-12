import type { SimulationStep } from '../types';
import { formatMs } from './frames';
import { PreviewFrame } from './preview-frame';

export function StepList(props: {
  readonly steps: readonly SimulationStep[];
  readonly activeStepIndex: number | undefined;
  readonly onSelectStep: (stepIndex: number) => void;
}) {
  const { steps, activeStepIndex, onSelectStep } = props;
  return (
    <nav className="steps" aria-label="Steps">
      {steps.map((step, i) => {
        const frameCount = step.frames?.length || (step.snapshotFile ? 1 : 0);
        const isActive = activeStepIndex === step.index;
        return (
          <button
            key={step.index}
            type="button"
            className={`step${isActive ? ' active' : ''}${
              step.status === 'failed' ? ' failed' : ''
            }`}
            onClick={() => onSelectStep(i)}
          >
            <div className="step-title">
              {step.index}. {step.title}
            </div>
            <div className="step-sub">
              {step.actorId} · {step.kind} · {formatMs(step.durationMs)}
              {frameCount ? ` · ${frameCount}f` : ''}
              {step.selector ? (
                <>
                  <br />
                  {step.selector}
                </>
              ) : null}
            </div>
          </button>
        );
      })}
    </nav>
  );
}

export function StepDetail(props: {
  readonly step: SimulationStep | undefined;
  readonly previewSrc: string | null;
}) {
  const { step, previewSrc } = props;
  const metaLine = step
    ? `${step.actorId} · ${step.kind} · ${step.status} · ${formatMs(step.durationMs)}`
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
          <div className="empty">Select a step</div>
        )}
      </div>
      <div className="preview">
        <PreviewFrame src={previewSrc} />
      </div>
    </section>
  );
}
