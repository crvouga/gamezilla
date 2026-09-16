const SHORTCUTS: ReadonlyArray<readonly [string, string]> = [
  ['← / →', 'Previous / next frame'],
  ['Home / End', 'First / last frame'],
  ['Space', 'Play / pause scrubbing'],
  ['[ / ]', 'Previous / next test'],
  ['1–9', 'Focus client panel'],
  ['M', 'Toggle multi / single view'],
  ['A', 'Toggle snapshots aside'],
  ['P', 'Toggle press overlay'],
  ['F', 'Cycle zoom (fit → 50 → 75 → 100)'],
  ['?', 'Toggle this help'],
  ['Esc', 'Back to test list / close help'],
];

export function HelpModal(props: { onClose: () => void }) {
  return (
    <div
      class="sr-help"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div class="sr-help-card">
        <h3>Keyboard shortcuts</h3>
        <dl>
          {SHORTCUTS.map(([k, v]) => (
            <>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </>
          ))}
        </dl>
      </div>
    </div>
  );
}
