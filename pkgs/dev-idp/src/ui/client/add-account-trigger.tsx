/** @jsxImportSource hono/jsx/dom */
import { c } from '../styles';

export const AddAccountTrigger = (props: {
  expanded: boolean;
  onToggle: () => void;
}) => (
  <div
    class={c.utilityRow}
    role="button"
    tabIndex={0}
    aria-controls="dev-idp-create-panel"
    aria-expanded={props.expanded ? 'true' : 'false'}
    data-testid="dev-idp-add-account-trigger"
    onClick={props.onToggle}
    onKeyDown={(ev: KeyboardEvent) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        (ev.currentTarget as HTMLElement).click();
      }
    }}
  >
    <span class={c.utilityPlus}>+</span>
    <span>Add another account</span>
  </div>
);
