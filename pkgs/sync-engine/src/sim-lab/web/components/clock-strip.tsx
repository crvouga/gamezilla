export function ClockStrip(props: {
  readonly busy: boolean;
  readonly onCommand: (cmd: Record<string, unknown>) => void;
}) {
  return (
    <div className="clock-strip">
      <strong>Clock</strong>
      {[50, 200, 1000].map((ms) => (
        <button
          key={ms}
          type="button"
          disabled={props.busy}
          onClick={() => props.onCommand({ type: 'runFor', ms })}
        >
          +{ms}ms
        </button>
      ))}
      <button
        type="button"
        disabled={props.busy}
        onClick={() => props.onCommand({ type: 'runUntilIdle' })}
      >
        Run until idle
      </button>
      <button
        type="button"
        disabled={props.busy}
        onClick={() => props.onCommand({ type: 'assertConverged' })}
      >
        Assert converged
      </button>
      <button
        type="button"
        disabled={props.busy}
        onClick={() => props.onCommand({ type: 'checkInvariants' })}
      >
        Check invariants
      </button>
    </div>
  );
}
