import type { LabAction } from '../api';

export function Timeline(props: { readonly actions: readonly LabAction[] }) {
  const items = [...props.actions].reverse().slice(0, 40);
  return (
    <div className="timeline">
      <h3>Action log</h3>
      <ol>
        {items.length === 0 ? (
          <li>No actions yet</li>
        ) : (
          items.map((a, i) => (
            <li key={`${a.at}-${i}`} className={a.ok ? '' : 'bad'}>
              {a.label}
              {a.error !== undefined ? ` — ${a.error}` : ''}
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
