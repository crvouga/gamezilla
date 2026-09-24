import { onMount } from 'solid-js';

const SHORTCUTS: ReadonlyArray<readonly [string, string]> = [
  ['⌘ K / Ctrl K', 'Open command palette'],
  ['← / →', 'Previous / next frame'],
  ['↑ / ↓', 'Previous / next step'],
  ['N / Shift N', 'Next / previous failure'],
  ['Home / End', 'First / last frame'],
  ['Space', 'Play / pause scrubbing'],
  ['[ / ]', 'Previous / next test'],
  ['1–9', 'Focus client panel'],
  ['M', 'All clients / focused client'],
  ['A', 'Toggle state panel'],
  ['P', 'Toggle press highlight'],
  ['F', 'Cycle zoom (fit → 50 → 75 → 100)'],
  ['?', 'Toggle this help'],
  ['Esc', 'Back to test list / close help'],
];

export function HelpModal(props: { onClose: () => void }) {
  let closeButton: HTMLButtonElement | undefined;
  onMount(() => closeButton?.focus());
  return (
    <div
      class="sr-help"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <section
        class="sr-help-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sr-help-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            props.onClose();
          }
        }}
      >
        <div class="sr-help-head">
          <h3 id="sr-help-title">Keyboard shortcuts</h3>
          <button
            ref={closeButton}
            type="button"
            class="sr-navbtn"
            aria-label="Close keyboard shortcuts"
            onClick={() => props.onClose()}
          >
            Close
          </button>
        </div>
        <dl>
          {SHORTCUTS.map(([key, description]) => (
            <>
              <dt>{key}</dt>
              <dd>{description}</dd>
            </>
          ))}
        </dl>
      </section>
    </div>
  );
}
